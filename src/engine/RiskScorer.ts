import { Signal, RiskLevel, ContentSource } from '../types';

export class RiskScorer {
  /**
   * Evaluates the extracted signals and context to compute a final risk score.
   */
  public calculateRisk(signals: Signal[], source: ContentSource): { severity: RiskLevel, score: number, reasons: string[] } {
    if (signals.length === 0) {
      return { severity: 'LOW', score: 0, reasons: [] };
    }

    const categories = new Set(signals.map(s => s.category));
    const reasons: string[] = [];
    let severity: RiskLevel = 'LOW';
    let score = 1;

    // Is there a known, explicitly supplied MCP tool reference?
    const hasKnownTool = categories.has('known_tool_reference');
    // Is there a candidate dotted identifier (e.g. email.send OR example.com)
    const hasCandidateTool = categories.has('candidate_tool_reference');

    // Is there an imperative instruction broadly? (call, download, ignore previous)
    const hasImperative = categories.has('imperative_agent_instruction') || categories.has('execution_command');
    
    // Is there a strict tool invocation verb? (call, invoke, trigger, use)
    // We treat 'imperative_agent_instruction' as our proxy for tool invocation 
    // because it contains words like 'call', 'invoke', 'use', 'execute'.
    // We do NOT treat 'execution_command' (download, install, shell) as tool invocation verbs.
    const hasToolInvocation = categories.has('imperative_agent_instruction');

    const hasExfil = categories.has('data_exfiltration_intent') || categories.has('sensitive_context_request');
    const hasAuthSpoof = categories.has('authority_spoofing') || categories.has('instruction_override');

    // The key architectural change:
    // A dotted candidate identifier ONLY upgrades to a cross-tool reference IF paired with a tool invocation verb.
    // Otherwise, domains like 'example.com' are naturally ignored as mere candidates without tool context.
    const isCrossTool = hasKnownTool || (hasCandidateTool && hasToolInvocation);

    if (hasAuthSpoof) {
      severity = 'CRITICAL';
      score = 10;
      reasons.push('Detected authority spoofing or instruction override attempt.');
    } else if (hasImperative && isCrossTool && hasExfil) {
      severity = 'CRITICAL';
      score = 9;
      reasons.push('Detected critical cross-tool injection with data exfiltration intent.');
    } else if (hasImperative && isCrossTool) {
      severity = 'HIGH';
      score = 7;
      reasons.push('Detected imperative instruction directed at another MCP tool.');
    } else if (hasExfil) {
      severity = 'HIGH';
      score = 6;
      reasons.push('Detected intent to access sensitive context or exfiltrate data.');
    } else if (hasImperative) {
      severity = 'MEDIUM';
      score = 4;
      reasons.push('Detected standalone imperative instruction.');
    } else if (isCrossTool || hasCandidateTool) {
      severity = 'LOW';
      score = 2;
      reasons.push('Detected benign cross-tool or candidate domain reference in descriptive context.');
    }

    return { severity, score, reasons };
  }
}

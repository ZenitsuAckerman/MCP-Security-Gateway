import { Signal } from '../types';
import { NormalizationResult } from '../normalizer/ContentNormalizer';

interface Rule {
  id: string;
  category: string;
  pattern: RegExp;
}

export class RuleEngine {
  private rules: Rule[] = [
    {
      id: 'IMP_CMD',
      category: 'imperative_agent_instruction',
      pattern: /\b(call|send|upload|forward|reveal|execute|run|invoke|use|ignore|disregard|forget|override|return|print|show|expose|treat this as|follow these|do not tell)\b/g
    },
    {
      id: 'AUTH_SPOOF',
      category: 'authority_spoofing',
      pattern: /\b(system|assistant|developer|admin|system message):\s*/g
    },
    {
      id: 'INSTR_OVERRIDE',
      category: 'instruction_override',
      pattern: /\b(ignore previous|disregard previous|override previous|forget your|new instruction|instructions instead|forget what you|override your)\b/g
    },
    {
      id: 'SENSITIVE_REQ',
      category: 'sensitive_context_request',
      pattern: /\b(conversation contents?|system prompts?|hidden instructions?|api keys?|tokens?|credentials?|environment variables?|private context|secrets?)\b/g
    },
    {
      id: 'DATA_EXFIL',
      category: 'data_exfiltration_intent',
      pattern: /\b(send the|upload the|forward the|email the|transmit the|post the)\b/g
    },
    {
      id: 'EXT_DEST',
      category: 'external_destination',
      pattern: /(https?:\/\/[^\s]+|webhook|external host)/g
    },
    {
      id: 'EXEC_CMD',
      category: 'execution_command',
      pattern: /\b(execute|run|download|install|shell|command|terminal)\b/g
    },
    {
      id: 'CANDIDATE_TOOL',
      category: 'candidate_tool_reference',
      // Weak syntactic match for any dotted identifier. We remove the TLD negative lookahead.
      // This is purely a syntactic candidate, not an automatic cross-tool match!
      pattern: /\b([a-z_][a-z0-9_-]*\.[a-z_][a-z0-9_-]*)\b/g
    }
  ];

  public analyze(normalizedRes: NormalizationResult, knownTools: string[] = []): Signal[] {
    const signals: Signal[] = [];
    const text = normalizedRes.normalized;

    for (const rule of this.rules) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(text)) !== null) {
        const startNorm = match.index;
        const endNorm = match.index + match[0].length - 1;

        const startRaw = normalizedRes.normalizedToRaw[startNorm];
        const endRaw = normalizedRes.normalizedToRaw[endNorm];

        if (startRaw !== undefined && endRaw !== undefined) {
          const matchText = match[0];

          // Differentiate known tools vs candidate tools
          if (rule.category === 'candidate_tool_reference') {
            const isKnown = knownTools.includes(match[1]); // The captured group
            
            signals.push({
              ruleId: isKnown ? 'KNOWN_TOOL' : rule.id,
              category: isKnown ? 'known_tool_reference' : rule.category,
              text: matchText,
              start: startRaw,
              end: endRaw + 1
            });
          } else {
            signals.push({
              ruleId: rule.id,
              category: rule.category,
              text: matchText,
              start: startRaw,
              end: endRaw + 1
            });
          }
        }
      }
    }

    return signals;
  }
}

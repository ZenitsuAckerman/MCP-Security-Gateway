import { 
  ContentSource, 
  DetectionResult, 
  DescriptionInspectionInput, 
  DescriptionInspectionResult, 
  OutputInspectionInput, 
  OutputInspectionResult,
  SecurityAction,
  SecurityEvent,
  TextBlock,
  SentinelConfig,
  RiskLevel
} from '../types';
import { ContentNormalizer } from '../normalizer/ContentNormalizer';
import { RuleEngine } from './RuleEngine';
import { RiskScorer } from './RiskScorer';
import { OutputSanitizer } from '../sanitizer/OutputSanitizer';

export type SecurityEventListener = (event: SecurityEvent) => void;

const DEFAULT_CONFIG: SentinelConfig = {
  descriptionBlockThreshold: 'HIGH',
  outputSanitizeThreshold: 'MEDIUM'
};

const SEVERITY_WEIGHTS: Record<RiskLevel, number> = {
  'LOW': 1,
  'MEDIUM': 2,
  'HIGH': 3,
  'CRITICAL': 4
};

export class DecisionEngine {
  private normalizer = new ContentNormalizer();
  private ruleEngine = new RuleEngine();
  private riskScorer = new RiskScorer();
  private sanitizer = new OutputSanitizer();
  private listeners = new Set<SecurityEventListener>();
  private config: SentinelConfig;

  constructor(config: Partial<SentinelConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public onEvent(listener: SecurityEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: SecurityEvent) {
    const frozenEvent = Object.freeze({ ...event });
    this.listeners.forEach((listener) => {
      try {
        listener(frozenEvent);
      } catch (e) {
        console.error('SecurityEventListener threw an error:', e);
      }
    });
  }

  private meetsThreshold(severity: RiskLevel, threshold: RiskLevel): boolean {
    return SEVERITY_WEIGHTS[severity] >= SEVERITY_WEIGHTS[threshold];
  }

  public inspectDescription(input: DescriptionInspectionInput): DescriptionInspectionResult {
    try {
      if (!input || typeof input.description !== 'string') {
        return this.createQuarantineDescription(input, 'Invalid input format or missing description string');
      }

      const detection = this.runDetection(input.description, 'tool_description', input.knownTools);

      let decision: SecurityAction = 'ALLOW';
      const events: SecurityEvent[] = [];

      if (this.meetsThreshold(detection.severity, this.config.descriptionBlockThreshold)) {
        decision = 'BLOCK';
        
        const isCrossTool = detection.matches.some(m => 
          m.category === 'known_tool_reference' || 
          (m.category === 'candidate_tool_reference' && detection.matches.some(x => x.category === 'imperative_agent_instruction'))
        );
        
        // Prefer known tool targets if they exist, otherwise fallback to candidate target
        let targetToolMatch = detection.matches.find(m => m.category === 'known_tool_reference');
        if (!targetToolMatch) {
            targetToolMatch = detection.matches.find(m => m.category === 'candidate_tool_reference');
        }
        
        const event: SecurityEvent = {
          id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
          event: isCrossTool ? 'cross_tool_instruction_blocked' : 'detector_flagged',
          timestamp: new Date().toISOString(),
          server: input.server,
          tool: input.tool,
          workflowId: input.workflowId,
          dataId: input.dataId,
          details: {
            sourceTool: input.tool,
            targetTool: isCrossTool ? targetToolMatch?.text : undefined,
            severity: detection.severity,
            decision,
            reasons: [...detection.reasons]
          }
        };
        events.push(event);
        this.emit(event);
      } else if (detection.severity !== 'LOW') {
        decision = 'FLAG';
      }

      return {
        decision,
        flagged: decision === 'BLOCK' || decision === 'FLAG',
        severity: detection.severity,
        score: detection.score,
        reasons: [...detection.reasons],
        matches: [...detection.matches],
        events
      };
    } catch (error) {
      return this.createQuarantineDescription(input, `Internal inspection failure. Input quarantined to prevent fail-open.`);
    }
  }

  public inspectOutput(input: OutputInspectionInput): OutputInspectionResult {
    try {
      if (!input || typeof input.content !== 'string') {
        return this.createQuarantineOutput(input, 'Invalid input format or missing content string');
      }

      if (input.content.trim() === '') {
        return {
          decision: 'ALLOW',
          sanitized: false,
          content: input.content,
          severity: 'LOW',
          score: 0,
          reasons: [],
          removedSegments: 0,
          events: []
        };
      }

      const detection = this.runDetection(input.content, 'tool_output', input.knownTools);
      const sanitization = this.sanitizer.sanitize(input.content, detection);
      
      let decision: SecurityAction = 'ALLOW';
      const events: SecurityEvent[] = [];

      if (sanitization.sanitized) {
        decision = 'SANITIZE';
        
        const isCrossTool = detection.matches.some(m => 
          m.category === 'known_tool_reference' || 
          (m.category === 'candidate_tool_reference' && detection.matches.some(x => x.category === 'imperative_agent_instruction'))
        );
        
        let targetToolMatch = detection.matches.find(m => m.category === 'known_tool_reference');
        if (!targetToolMatch) {
            targetToolMatch = detection.matches.find(m => m.category === 'candidate_tool_reference');
        }
        
        const eventType = isCrossTool ? 'cross_tool_instruction_blocked' : 'output_sanitized';

        const event: SecurityEvent = {
          id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
          event: eventType,
          timestamp: new Date().toISOString(),
          server: input.server,
          tool: input.tool,
          workflowId: input.workflowId,
          dataId: input.dataId,
          details: {
            sourceTool: input.tool,
            targetTool: isCrossTool ? targetToolMatch?.text : undefined,
            severity: detection.severity,
            decision,
            reasons: [...detection.reasons],
            removedSegments: sanitization.removedSegments
          }
        };
        events.push(event);
        this.emit(event);
      } else if (this.meetsThreshold(detection.severity, 'CRITICAL') && !sanitization.sanitized) {
        return this.createQuarantineOutput(input, 'Critical detection could not be safely sanitized');
      }

      return {
        decision,
        sanitized: sanitization.sanitized,
        content: sanitization.content,
        severity: detection.severity,
        score: detection.score,
        reasons: [...detection.reasons],
        removedSegments: sanitization.removedSegments,
        events
      };
    } catch (error) {
      return this.createQuarantineOutput(input, `Internal inspection failure. Input quarantined to prevent fail-open.`);
    }
  }

  public inspectTextBlocks(blocks: TextBlock[], inputMeta: Omit<OutputInspectionInput, 'content'>): { sanitized: boolean, blocks: TextBlock[], events: SecurityEvent[] } {
    if (!Array.isArray(blocks)) {
      throw new Error('inspectTextBlocks requires an array of text blocks');
    }

    let overallSanitized = false;
    const processedBlocks: TextBlock[] = [];
    const allEvents: SecurityEvent[] = [];

    for (const block of blocks) {
      if (block.type !== 'text' || typeof block.text !== 'string') {
        processedBlocks.push({ ...block });
        continue;
      }

      const res = this.inspectOutput({
        ...inputMeta,
        content: block.text
      });

      processedBlocks.push({
        ...block,
        text: res.content
      });

      if (res.sanitized) {
        overallSanitized = true;
      }
      allEvents.push(...res.events);
    }

    return { sanitized: overallSanitized, blocks: processedBlocks, events: allEvents };
  }

  private runDetection(text: string, source: ContentSource, knownTools?: string[]): DetectionResult {
    const normRes = this.normalizer.normalize(text);
    const matches = this.ruleEngine.analyze(normRes, knownTools);
    const risk = this.riskScorer.calculateRisk(matches, source);

    let flagged = false;
    if (this.meetsThreshold(risk.severity, this.config.descriptionBlockThreshold)) {
      flagged = true;
    } else if (source === 'tool_output' && this.meetsThreshold(risk.severity, this.config.outputSanitizeThreshold)) {
      const hasImperative = matches.some(m => m.category === 'imperative_agent_instruction');
      if (hasImperative) {
        flagged = true;
      }
    }

    return {
      flagged,
      severity: risk.severity,
      score: risk.score,
      reasons: risk.reasons,
      matches
    };
  }

  private createQuarantineDescription(input: Partial<DescriptionInspectionInput>, reason: string): DescriptionInspectionResult {
    const event: SecurityEvent = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
      event: 'inspection_failed',
      timestamp: new Date().toISOString(),
      server: input?.server,
      tool: input?.tool,
      details: {
        severity: 'CRITICAL',
        decision: 'QUARANTINE',
        reasons: [reason]
      }
    };
    this.emit(event);
    
    return {
      decision: 'QUARANTINE',
      flagged: true,
      severity: 'CRITICAL',
      score: 10,
      reasons: [reason],
      matches: [],
      events: [event]
    };
  }

  private createQuarantineOutput(input: Partial<OutputInspectionInput>, reason: string): OutputInspectionResult {
    const event: SecurityEvent = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
      event: 'inspection_failed',
      timestamp: new Date().toISOString(),
      server: input?.server,
      tool: input?.tool,
      details: {
        severity: 'CRITICAL',
        decision: 'QUARANTINE',
        reasons: [reason],
        removedSegments: 0
      }
    };
    this.emit(event);
    
    return {
      decision: 'QUARANTINE',
      sanitized: false,
      content: '',
      severity: 'CRITICAL',
      score: 10,
      reasons: [reason],
      removedSegments: 0,
      events: [event]
    };
  }
}

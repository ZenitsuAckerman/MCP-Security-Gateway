import { IncomingEvent } from './contract';

export const mockEvents: IncomingEvent[] = [
  {
    id: 'evt-1',
    timestamp: Date.now() - 10000,
    type: 'tool_call', // using 'type'
    server: 'calculator',
    tool: 'evaluate',
    workflowId: 'wf-1',
    details: { expression: '2 + 2' }
  },
  {
    id: 'evt-2',
    timestamp: Date.now() - 5000,
    event: 'manifest_mismatch', // using 'event'
    server: 'calculator',
    tool: 'evaluate',
    details: {
      oldHash: 'abc',
      newHash: 'def'
    }
  },
  {
    // missing id and timestamp, to test normalization defaults
    event: 'detector_flagged',
    server: 'docgen',
    tool: 'create',
    details: { reason: 'malicious input' }
  }
];

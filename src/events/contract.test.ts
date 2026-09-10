import { normalizeEvent, IncomingEvent } from './contract';
import * as crypto from 'crypto';

// Polyfill crypto for tests if needed
if (!global.crypto) {
  (global as any).crypto = {
    randomUUID: () => crypto.randomUUID()
  };
}

describe('normalizeEvent', () => {
  it('should normalize an event using the "type" field', () => {
    const raw: IncomingEvent = {
      id: '123',
      timestamp: 1600000000000,
      type: 'tool_call',
      server: 'calc'
    };
    const normalized = normalizeEvent(raw);
    expect(normalized.type).toBe('tool_call');
    expect(normalized.id).toBe('123');
    expect(normalized.timestamp).toBe(1600000000000);
    expect(normalized.server).toBe('calc');
  });

  it('should normalize an event using the "event" field', () => {
    const raw: IncomingEvent = {
      event: 'detector_flagged',
      tool: 'eval'
    };
    const normalized = normalizeEvent(raw);
    expect(normalized.type).toBe('detector_flagged');
    expect(normalized.id).toBeDefined();
    expect(normalized.timestamp).toBeDefined();
    expect(normalized.tool).toBe('eval');
  });

  it('should prefer "type" over "event" if both are provided', () => {
    const raw: IncomingEvent = {
      type: 'tool_result',
      event: 'tool_call' // conflicting
    };
    const normalized = normalizeEvent(raw);
    expect(normalized.type).toBe('tool_result');
  });

  it('should safely map unknown/missing discriminator to "unknown" rather than throwing', () => {
    const raw: IncomingEvent = {
      server: 'test'
    };
    const normalized = normalizeEvent(raw);
    expect(normalized.type).toBe('unknown');
    expect(normalized.server).toBe('test');
  });

  it('should safely handle completely malformed input (null, number, array) without crashing', () => {
    expect(normalizeEvent(null).type).toBe('unknown');
    expect(normalizeEvent(123).type).toBe('unknown');
    expect(normalizeEvent([]).type).toBe('unknown');
    expect(normalizeEvent(undefined).type).toBe('unknown');
  });

  it('should cast non-string valid fields to strings safely or undefined', () => {
    const raw = {
      type: 'manifest_pinned',
      server: { bad: 'object' },
      tool: 42,
      workflowId: null,
      dataId: ''
    };
    const normalized = normalizeEvent(raw);
    expect(normalized.type).toBe('manifest_pinned');
    expect(normalized.server).toBeUndefined(); // Object stripped out
    expect(normalized.tool).toBe('42'); // Number casted to string
    expect(normalized.workflowId).toBeUndefined(); // null stripped
    expect(normalized.dataId).toBeUndefined(); // empty string stripped
  });

  it('should preserve arbitrary details metadata', () => {
    const raw = {
      type: 'detector_flagged',
      details: { complex: { object: true }, array: [1, 2, 3] }
    };
    const normalized = normalizeEvent(raw);
    expect(normalized.details).toEqual({ complex: { object: true }, array: [1, 2, 3] });
  });
});

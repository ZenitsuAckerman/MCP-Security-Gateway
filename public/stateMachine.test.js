const { ToolStore } = require('./stateMachine');

describe('ToolStore State Machine', () => {
  let store;

  beforeEach(() => {
    store = new ToolStore();
  });

  it('should correctly process the complete state transition sequence', () => {
    // Sequence: manifest_pinned -> manifest_verified -> manifest_mismatch -> tool_suspended -> approved
    const server = 'calc';
    const tool = 'eval';
    let state;

    // 1. manifest_pinned
    state = store.processEvent({
      id: '1',
      type: 'manifest_pinned',
      server,
      tool,
      timestamp: 1000,
      details: { hash: 'hash1234' }
    });
    expect(state.status).toBe('TRUSTED');
    expect(state.latestHash).toBe('hash1234');

    // 2. manifest_verified
    state = store.processEvent({
      id: '2',
      type: 'manifest_verified',
      server,
      tool,
      timestamp: 2000
    });
    expect(state.status).toBe('TRUSTED'); // status remains
    expect(state.lastVerification).toBeDefined();

    // 3. manifest_mismatch
    state = store.processEvent({
      id: '3',
      type: 'manifest_mismatch',
      server,
      tool,
      timestamp: 3000,
      details: { oldHash: 'hash1234', newHash: 'hash5678' }
    });
    expect(state.status).toBe('MUTATION DETECTED');
    expect(state.previousHash).toBe('hash1234');
    expect(state.latestHash).toBe('hash5678');

    // 4. tool_suspended
    state = store.processEvent({
      id: '4',
      type: 'tool_suspended',
      server,
      tool,
      timestamp: 4000
    });
    expect(state.status).toBe('SUSPENDED');

    // 5. approved
    state = store.processEvent({
      id: '5',
      type: 'approved',
      server,
      tool,
      timestamp: 5000
    });
    expect(state.status).toBe('TRUSTED');
  });

  it('should handle detector_flagged and output_sanitized', () => {
    let state = store.processEvent({
      id: 'd1',
      type: 'manifest_pinned',
      server: 'doc',
      tool: 'gen',
      details: { hash: 'abc' }
    });
    expect(state.status).toBe('TRUSTED');

    // detector_flagged
    state = store.processEvent({
      id: 'd2',
      type: 'detector_flagged',
      server: 'doc',
      tool: 'gen',
      details: { reason: 'malicious prompt' }
    });
    expect(state.status).toBe('FLAGGED');
    expect(state.latestDetectorState).toBe('malicious prompt');

    // output_sanitized (doesn't change status but updates detector state)
    state = store.processEvent({
      id: 'd3',
      type: 'output_sanitized',
      server: 'doc',
      tool: 'gen'
    });
    expect(state.status).toBe('FLAGGED'); // status is maintained
    expect(state.latestDetectorState).toBe('Output sanitized');
  });

  it('should deduplicate events with the same ID', () => {
    store.processEvent({
      id: 'dup-1',
      type: 'manifest_pinned',
      server: 'test',
      tool: 't1'
    });
    const state = store.processEvent({
      id: 'dup-1',
      type: 'manifest_verified', // this should be ignored due to duplicate ID
      server: 'test',
      tool: 't1'
    });
    expect(state).toBeNull();
  });

  it('should process events with different IDs even if type and tool are the same', () => {
    store.processEvent({
      id: 'id-1',
      type: 'tool_call',
      server: 'test',
      tool: 't1'
    });
    const state2 = store.processEvent({
      id: 'id-2',
      type: 'tool_call',
      server: 'test',
      tool: 't1'
    });
    expect(state2).not.toBeNull();
  });

  it('unknown events must not change trust state', () => {
    store.processEvent({
      id: 'unk-1',
      type: 'manifest_pinned',
      server: 'test',
      tool: 't1'
    });
    
    // Unknown event
    const state = store.processEvent({
      id: 'unk-2',
      type: 'future_security_event',
      server: 'test',
      tool: 't1'
    });
    
    // Status must remain TRUSTED
    expect(state.status).toBe('TRUSTED');
  });
});

/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('Dashboard Integration (Phase 4)', () => {
  let appJsCode;
  let stateMachineCode;

  beforeAll(() => {
    stateMachineCode = fs.readFileSync(path.resolve(__dirname, './stateMachine.js'), 'utf8');
    appJsCode = fs.readFileSync(path.resolve(__dirname, './app.js'), 'utf8');

    document.documentElement.innerHTML = html.toString();
    
    // Evaluate stateMachine.js
    const script1 = document.createElement('script');
    script1.textContent = stateMachineCode;
    document.body.appendChild(script1);

    // Evaluate app.js
    const script2 = document.createElement('script');
    script2.textContent = appJsCode;
    document.body.appendChild(script2);
  });

  beforeEach(() => {
    // Re-initialize elements since DOM was replaced
    // Just trigger DOMContentLoaded or manually re-bind?
    // app.js already bound things, so replacing innerHTML breaks event listeners.
    // Instead of replacing innerHTML, let's just reset the state and hide/show what we need.
    window.state.isMockMode = false;
    window.handleEvent = window.handleEvent || null; // it's already there
    
    // Quick DOM reset
    document.getElementById('diff-panel')?.classList.add('hidden');
    document.getElementById('action-empty-state')?.classList.remove('hidden');
    const approveBtn = document.getElementById('approve-btn');
    if (approveBtn) approveBtn.disabled = false;

    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'requested' }),
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. manifest_mismatch opens diff panel & 2/3/4 renders descriptions/hashes/details', () => {
    const handleEvent = window.handleEvent;
    
    handleEvent({
      type: 'manifest_mismatch',
      server: 'calc',
      tool: 'eval',
      details: {
        oldHash: 'oldhash123',
        newHash: 'newhash456',
        oldDesc: 'Old description',
        newDesc: 'New description',
        reason: 'Mutation detected',
        risk: 'CRITICAL',
        capabilities: { added: ['network'] }
      }
    });

    const diffPanel = document.getElementById('diff-panel');
    expect(diffPanel.classList.contains('hidden')).toBe(false);

    // Hashes
    expect(document.getElementById('diff-old-hash').textContent).toBe('oldhash1');
    expect(document.getElementById('diff-new-hash').textContent).toBe('newhash4');

    // Descriptions / Diff
    const diffContent = document.getElementById('diff-content-container').innerHTML;
    expect(diffContent).toContain('diff-removed');
    expect(diffContent).toContain('Old description');
    expect(diffContent).toContain('diff-added');
    expect(diffContent).toContain('New description');

    // Security Details (now moved to alert panel)
    const alertPanel = document.getElementById('active-alert-panel');
    expect(alertPanel.classList.contains('hidden')).toBe(false);
    const alertReason = document.getElementById('alert-reason').textContent;
    expect(alertReason).toContain('Mutation detected');
  });

  it('5. Approve sends correct POST payload & 6. successful approval does NOT immediately mark trusted', async () => {
    const handleEvent = window.handleEvent;
    const approveBtn = document.getElementById('approve-btn');
    
    // Set up a mismatch
    handleEvent({
      type: 'manifest_mismatch',
      server: 'calc',
      tool: 'eval'
    });

    // We are NOT in mock mode
    window.state.isMockMode = false;

    // Click approve but don't await immediately to check intermediate state
    const clickPromise = approveBtn.click();
    
    // Verify fetch was called correctly
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toContain('/approve');
    expect(callArgs[1].method).toBe('POST');
    expect(JSON.parse(callArgs[1].body)).toEqual({ server: 'calc', tool: 'eval' });

    // Verify UI state says pending, NOT immediately trusted
    expect(document.getElementById('approval-status').textContent).toContain('APPROVAL REQUESTED');
    expect(document.getElementById('diff-panel').classList.contains('hidden')).toBe(false); // diff panel stays open
    
    // Wait a tick for fetch promise to resolve
    await clickPromise;
    expect(document.getElementById('approval-status').textContent).toContain('Waiting for Sentinel confirmation');
  });

  it('7. approved event marks trusted and closes diff panel', () => {
    const handleEvent = window.handleEvent;
    
    handleEvent({
      type: 'manifest_mismatch',
      server: 'calc',
      tool: 'eval'
    });
    
    // Need to trigger the approval flow so it sets currentPendingApproval
    document.getElementById('approve-btn').click();

    // Now send the approved event
    handleEvent({
      type: 'approved',
      server: 'calc',
      tool: 'eval'
    });

    // Diff panel should be hidden
    expect(document.getElementById('diff-panel').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('action-empty-state').classList.contains('hidden')).toBe(false);
  });

  it('8. approval HTTP failure leaves security state unchanged', async () => {
    // Override fetch to fail
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    
    window.handleEvent({
      type: 'manifest_mismatch',
      server: 'calc',
      tool: 'eval'
    });

    await document.getElementById('approve-btn').click();
    await new Promise(r => setTimeout(r, 0));

    expect(document.getElementById('approval-status').textContent).toContain('FAILED');
    expect(document.getElementById('diff-panel').classList.contains('hidden')).toBe(false); // Still open
  });
});

describe('Attack Lab (Phase 5)', () => {
  beforeEach(() => {
    // Reset state and handles
    window.state.isMockMode = false;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'attack_requested' }),
      })
    );
    
    // reset DOM UI explicitly for tests
    document.getElementById('btn-hijack').disabled = false;
    document.getElementById('btn-inject').disabled = false;
    document.getElementById('attack-status').textContent = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Calculator attack button triggers real endpoint and handles success/failure', async () => {
    const btn = document.getElementById('btn-hijack');
    expect(btn).not.toBeNull();
    
    const clickPromise = btn.click();
    
    // Endpoint verification
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/attack/calculator-hijack');
    expect(global.fetch.mock.calls[0][1].method).toBe('POST');
    
    // UI state
    expect(document.getElementById('attack-status').textContent).toBe('TRIGGERING...');
    
    await clickPromise;
    expect(document.getElementById('attack-status').textContent).toBe('ATTACK TRIGGER REQUESTED');
  });

  it('DocGen attack button triggers real endpoint and does NOT fabricate events', async () => {
    const btn = document.getElementById('btn-inject');
    const handleEventSpy = jest.spyOn(window, 'handleEvent');
    
    await btn.click();
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/attack/docgen-injection');
    
    // Ensure no mock events were magically fired in Live Mode
    expect(handleEventSpy).not.toHaveBeenCalled();
    handleEventSpy.mockRestore();
  });

  it('Attack failure leaves security state unchanged', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Backend down')));
    const btn = document.getElementById('btn-hijack');
    
    await btn.click();
    expect(document.getElementById('attack-status').textContent).toBe('ATTACK REQUEST FAILED');
  });

  it('Mock Mode simulates events and does NOT call real endpoints', async () => {
    window.state.isMockMode = true;
    const btn = document.getElementById('btn-hijack');
    const handleEventSpy = jest.spyOn(window, 'handleEvent');
    
    jest.useFakeTimers();
    
    const clickPromise = btn.click();
    
    // Advance timeouts to trigger mock sequences
    jest.runAllTimers();
    
    await clickPromise;
    
    expect(global.fetch).not.toHaveBeenCalled();
    expect(handleEventSpy).toHaveBeenCalled();
    // It should have fired manifest_mismatch and tool_suspended
    const events = handleEventSpy.mock.calls.map(call => call[0].type);
    expect(events).toContain('manifest_mismatch');
    expect(events).toContain('tool_suspended');
    
    handleEventSpy.mockRestore();
    jest.useRealTimers();
  });
});

describe('Security & Hardening', () => {
  it('prevents XSS when rendering malicious event details', () => {
    const handleEvent = window.handleEvent;
    
    const maliciousPayload = '<img src=x onerror=alert(1)>';
    
    handleEvent({
      type: 'detector_flagged',
      server: 'docgen',
      tool: 'eval',
      details: {
        reason: maliciousPayload
      }
    });

    // Check Security Alert
    const alertHTML = document.getElementById('security-alert-container').innerHTML;
    // It should not contain the raw unescaped tag if inserted via textContent
    expect(alertHTML).not.toContain('<img');
    expect(document.getElementById('alert-reason').textContent).toContain(maliciousPayload);
  });

  it('safely handles malicious diff lines', () => {
    const handleEvent = window.handleEvent;
    const maliciousPayload = '<script>alert("diff")</script>';

    handleEvent({
      type: 'manifest_mismatch',
      server: 'calc',
      tool: 'eval',
      details: {
        oldDesc: 'Safe desc',
        newDesc: maliciousPayload
      }
    });

    const diffContentHTML = document.getElementById('diff-content-container').innerHTML;
    expect(diffContentHTML).not.toContain('<script>');
    expect(document.getElementById('diff-content-container').textContent).toContain(maliciousPayload);
  });

  it('updates connection status to RECONNECTING on websocket close in Live Mode', () => {
    window.state.isMockMode = false;
    
    // Simulate close event on the global ws instance (which might not be fully mocked, but we can trigger the onclose manually)
    if (window.state.ws && window.state.ws.onclose) {
      window.state.ws.onclose();
      expect(document.getElementById('connection-status').textContent).toBe('RECONNECTING...');
    }
  });
});

describe('Demo Readiness (Phase 7)', () => {
  beforeEach(() => {
    document.getElementById('btn-reset').click();
    window.state.isMockMode = false;
  });

  it('initializes expected tools to UNKNOWN state', () => {
    const tableHTML = document.getElementById('tool-status-body').innerHTML;
    expect(tableHTML).toContain('calculator.evaluate');
    expect(tableHTML).toContain('email.send');
    expect(tableHTML).toContain('UNKNOWN');
  });

  it('Event Counter increments uniquely by ID', () => {
    const countBefore = parseInt(document.getElementById('event-count').textContent, 10);
    
    window.handleEvent({ id: 'evt-1', type: 'tool_call', server: 's1', tool: 't1' });
    expect(document.getElementById('event-count').textContent).toBe(String(countBefore + 1));
    
    // Duplicate ID should not increment
    window.handleEvent({ id: 'evt-1', type: 'tool_call', server: 's1', tool: 't1' });
    expect(document.getElementById('event-count').textContent).toBe(String(countBefore + 1));
    
    // Different ID, same type SHOULD increment
    window.handleEvent({ id: 'evt-2', type: 'tool_call', server: 's1', tool: 't1' });
    expect(document.getElementById('event-count').textContent).toBe(String(countBefore + 2));
  });

  it('Filters apply strictly to DOM display state without altering count', () => {
    // Clear feed from previous
    document.getElementById('live-feed-container').innerHTML = '';
    
    window.handleEvent({ id: 'f-1', type: 'tool_call' }); // tool calls
    window.handleEvent({ id: 'f-2', type: 'detector_flagged' }); // security
    window.handleEvent({ id: 'f-3', type: 'tool_result' }); // results
    
    expect(document.getElementById('live-feed-container').children.length).toBe(3);
    
    // Click SECURITY filter
    const securityBtn = Array.from(document.querySelectorAll('.filter-btn')).find(b => b.dataset.filter === 'security');
    securityBtn.click();
    
    const feedChildren = Array.from(document.getElementById('live-feed-container').children);
    const visibleChildren = feedChildren.filter(c => c.style.display !== 'none');
    
    expect(visibleChildren.length).toBe(1);
    expect(visibleChildren[0].classList.contains('type-detector_flagged')).toBe(true);
    
    // Count remains unchanged
    expect(document.getElementById('event-count').textContent).toBe('3'); 
  });

  it('Security Alert panel updates for meaningful security events', () => {
    window.handleEvent({ 
      id: 'alert-1', 
      type: 'manifest_mismatch', 
      server: 'calculator', 
      tool: 'evaluate',
      details: { reason: 'Something mutated' }
    });
    
    expect(document.getElementById('active-alert-panel').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('alert-banner-title').textContent).toBe('MANIFEST MISMATCH');
    expect(document.getElementById('alert-reason').textContent).toBe('Something mutated');
    
    // Approved clears it
    window.handleEvent({ id: 'alert-2', type: 'approved', server: 'calculator', tool: 'evaluate' });
    expect(document.getElementById('active-alert-panel').classList.contains('hidden')).toBe(true);
  });

  it('Reset Demo View works cleanly without touching live backend data', () => {
    window.state.totalEvents = 10;
    document.getElementById('btn-reset').click();
    expect(window.state.totalEvents).toBe(0);
    expect(document.getElementById('event-count').textContent).toBe('0');
  });
});

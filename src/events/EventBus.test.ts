import { EventBus } from './EventBus';
import { IncomingEvent } from './contract';
import WebSocket from 'ws';

describe('EventBus', () => {
  let eventBus: EventBus;
  const PORT = 34567; // use a random high port

  beforeEach(async () => {
    eventBus = new EventBus();
    await eventBus.start(PORT);
  });

  afterEach(async () => {
    await eventBus.stop();
  });

  it('should emit an event and not crash', (done) => {
    const rawEvent: IncomingEvent = { type: 'tool_call', server: 'calc', tool: 'eval' };
    
    // We wrap in a promise to wait for setImmediate execution
    eventBus.emitAuditEvent(rawEvent);
    
    setImmediate(() => {
      const history = eventBus.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].type).toBe('tool_call');
      done();
    });
  });

  it('should broadcast event to connected WebSocket clients', (done) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    
    ws.on('open', () => {
      // First, it might receive history, then live events
      let receivedLiveEvent = false;

      ws.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        if (payload.type === 'live_event') {
          expect(payload.data.type).toBe('detector_flagged');
          expect(payload.data.server).toBe('docgen');
          receivedLiveEvent = true;
          ws.close();
          done();
        }
      });

      // Emit event after connection is established
      eventBus.emitAuditEvent({ type: 'detector_flagged', server: 'docgen' });
    });
  });

  it('should support multiple dashboard clients', (done) => {
    const ws1 = new WebSocket(`ws://localhost:${PORT}`);
    const ws2 = new WebSocket(`ws://localhost:${PORT}`);
    let receivedCount = 0;

    const checkDone = () => {
      receivedCount++;
      if (receivedCount === 2) {
        ws1.close();
        ws2.close();
        done();
      }
    };

    ws1.on('open', () => {
      ws1.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        if (payload.type === 'live_event') checkDone();
      });
    });

    ws2.on('open', () => {
      ws2.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        if (payload.type === 'live_event') checkDone();
      });

      // Emit event after ws2 is established
      eventBus.emitAuditEvent({ type: 'tool_result' });
    });
  });

  it('malformed event does not crash Sentinel and maps to unknown', (done) => {
    const rawEvent: any = { server: 'bad' }; // no discriminator
    
    expect(() => {
      eventBus.emitAuditEvent(rawEvent);
    }).not.toThrow();

    setImmediate(() => {
      const history = eventBus.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].type).toBe('unknown');
      done();
    });
  });

  it('disconnected dashboard does not break Sentinel', (done) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    
    ws.on('open', () => {
      // abruptly close
      ws.terminate();
      
      // wait a bit and emit event
      setTimeout(() => {
        expect(() => {
          eventBus.emitAuditEvent({ type: 'approved', server: 'calc' });
        }).not.toThrow();
        
        setImmediate(() => {
          const history = eventBus.getHistory();
          expect(history.length).toBe(1);
          done();
        });
      }, 50);
    });
  });

  it('should deduplicate events with the identical ID', (done) => {
    const id = 'dup-id';
    eventBus.emitAuditEvent({ id, type: 'tool_call', server: 'calc' });
    eventBus.emitAuditEvent({ id, type: 'tool_call', server: 'calc' });

    setImmediate(() => {
      const history = eventBus.getHistory();
      expect(history.length).toBe(1); // deduplicated
      done();
    });
  });
});

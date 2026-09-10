import { IncomingEvent, SentinelEvent, normalizeEvent } from './contract';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';

export class EventBus {
  private events: SentinelEvent[] = [];
  private wss: WebSocketServer | null = null;
  private server: http.Server | null = null;
  private seenIds = new Set<string>();
  
  private MAX_HISTORY = 1000;

  /**
   * Starts the Event Bus WebSocket server on the given port.
   * Optionally accepts an existing HTTP server.
   */
  public start(port: number, existingServer?: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
      if (existingServer) {
        this.server = existingServer;
      } else {
        this.server = http.createServer((req, res) => {
          // Optional HTTP endpoint for healthcheck
          if (req.url === '/health') {
            res.writeHead(200);
            res.end('OK');
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        });
      }

      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws) => {
        ws.on('error', console.error);
        
        // Send history of events to the new client
        try {
          const historyPayload = JSON.stringify({ type: 'history', data: this.events });
          ws.send(historyPayload, (err) => {
            if (err) console.error('Error sending history:', err);
          });
        } catch (err) {
          console.error('Exception sending history to client:', err);
        }
      });

      // If we created the server, we need to listen
      if (!existingServer) {
        this.server.on('error', (err) => reject(err));
        this.server.listen(port, () => {
          console.log(`Event Bus listening on port ${port}`);
          resolve();
        });
      } else {
        resolve(); // Server already listening or managed externally
      }
    });
  }

  /**
   * Stops the Event Bus server
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wss) {
        // Ensure all clients are cleanly closed
        for (const client of this.wss.clients) {
          try { client.close(); } catch (err) {}
        }
        this.wss.close();
      }
      if (this.server) {
        this.server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Emits an audit event without blocking the caller.
   */
  public emitAuditEvent(rawEvent: any): void {
    // Non-blocking: process asynchronously so caller (Sentinel) is never blocked
    setImmediate(() => {
      try {
        const normalized = normalizeEvent(rawEvent);
        
        // Deduplicate by strict ID
        if (this.seenIds.has(normalized.id)) {
          return;
        }
        
        this.seenIds.add(normalized.id);
        this.events.push(normalized);
        
        // Bounded history and duplicate cache
        if (this.events.length > this.MAX_HISTORY) {
          const removed = this.events.shift();
          if (removed) {
            this.seenIds.delete(removed.id);
          }
        }
        
        this.broadcast(normalized);
      } catch (err) {
        console.error('Failed to emit audit event:', err);
      }
    });
  }

  private broadcast(event: SentinelEvent): void {
    if (!this.wss) return;

    let payload: string;
    try {
      payload = JSON.stringify({ type: 'live_event', data: event });
    } catch (err) {
      console.error('Failed to stringify event payload:', err);
      return;
    }

    this.wss.clients.forEach((client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          // Use a callback to catch send errors without crashing
          client.send(payload, { binary: false }, (err) => {
            if (err) {
              console.error('Failed to send event to client:', err);
            }
          });
        }
      } catch (err) {
        console.error('Exception sending event to isolated subscriber:', err);
      }
    });
  }

  /**
   * Returns the event history.
   */
  public getHistory(): SentinelEvent[] {
    return this.events;
  }
}

class ToolStore {
  constructor() {
    this.tools = new Map(); // key: 'server:tool'
    this.seenIds = new Set();
    this.idHistory = []; // to bound the set
    this.MAX_IDS = 1000;
  }

  getTool(server, tool) {
    const key = `${server}:${tool}`;
    if (!this.tools.has(key)) {
      this.tools.set(key, {
        server,
        tool,
        status: 'UNKNOWN',
        latestHash: '-',
        previousHash: '-',
        lastVerification: '-',
        lastEvent: null,
        latestDetectorState: null,
        workflowId: null,
        dataId: null
      });
    }
    return this.tools.get(key);
  }

  processEvent(event) {
    if (!event.server || !event.tool) return null;
    
    // Deduplication by ID
    if (event.id) {
      if (this.seenIds.has(event.id)) {
        return null; // Duplicate
      }
      this.seenIds.add(event.id);
      this.idHistory.push(event.id);
      if (this.idHistory.length > this.MAX_IDS) {
        const removed = this.idHistory.shift();
        this.seenIds.delete(removed);
      }
    }
    
    const toolState = this.getTool(event.server, event.tool);
    toolState.lastEvent = event;
    
    if (event.workflowId) toolState.workflowId = event.workflowId;
    if (event.dataId) toolState.dataId = event.dataId;

    const eventType = event.type || event.event || 'unknown';

    switch (eventType) {
      case 'manifest_pinned':
        toolState.status = 'TRUSTED';
        if (event.details && event.details.hash) {
          toolState.latestHash = String(event.details.hash).substring(0, 8);
        }
        break;
      case 'manifest_verified':
        // Maintains current status, just updates timestamp
        toolState.lastVerification = new Date(event.timestamp || Date.now()).toLocaleTimeString();
        break;
      case 'manifest_mismatch':
        toolState.status = 'MUTATION DETECTED';
        if (event.details && event.details.oldHash) {
          toolState.previousHash = String(event.details.oldHash).substring(0, 8);
        }
        if (event.details && event.details.newHash) {
          toolState.latestHash = String(event.details.newHash).substring(0, 8);
        }
        break;
      case 'tool_suspended':
        toolState.status = 'SUSPENDED';
        break;
      case 'detector_flagged':
        toolState.status = 'FLAGGED';
        toolState.latestDetectorState = event.details && event.details.reason ? String(event.details.reason) : 'Flagged';
        break;
      case 'output_sanitized':
        // status remains as is, but we log the detector action
        toolState.latestDetectorState = 'Output sanitized';
        break;
      case 'approved':
        toolState.status = 'TRUSTED';
        break;
      case 'tool_call':
      case 'tool_result':
        // standard events don't modify security state
        break;
      default:
        // Unknown event MUST NOT change trust state
        break;
    }
    return toolState;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ToolStore };
}

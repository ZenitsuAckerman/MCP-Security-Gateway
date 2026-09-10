# Person 3 Integration Harness

## Purpose
This is a local integration contract harness created to simulate the data crossing the future Sentinel Proxy boundary. It proves that the public API boundary for Person 3 is integration-ready and adheres to the team's data contracts before the actual proxy implementation arrives.

**It is NOT the real MCP transport.**

## Boundaries
- **Person 1**: Owns the transport, TCP/HTTP servers, the actual Sentinel router, and the MCP client.
- **Person 2**: Owns Manifest Integrity (hashing, baseline, approval).
- **Person 3 (This Module)**: Owns Content Security (description inspection and output sanitization).
- **Person 4**: Owns Event Dashboard and telemetry.

## Input Contracts
- **Description Inspection**: Receives a `DescriptionInspectionInput` mapping directly to the `tools/list` attributes (`server`, `tool`, `description`).
- **Output Inspection**: Receives an `OutputInspectionInput` mapping directly to the `tools/call` response string.

## Output Contracts
- **Description Decision**: Returns `ALLOW`, `FLAG`, `BLOCK`, or `QUARANTINE`. If blocked, the proxy must omit the tool from the `tools/list` response.
- **Output Sanitization**: Returns `ALLOW` or `SANITIZE`. If sanitized, the proxy must replace the payload with the safe `.content` string.

## Event Contract
Uses the common shared event structure defined in `TEAM_INTEGRATION.md`:
```typescript
{
  id: string,
  timestamp: string,
  event: string,
  server?: string,
  tool?: string,
  workflowId?: string,
  dataId?: string,
  details: {
    decision: string,
    severity: string,
    reasons: string[],
    sourceTool?: string,
    targetTool?: string,
    removedSegments?: number
  }
}
```

## Migration Path

### CURRENT
```text
MockSentinelPipeline
        ↓
ContentSecurityAdapter
        ↓
Person 3
```

### LATER
```text
Real Sentinel Proxy
        ↓
ContentSecurityAdapter
        ↓
Person 3
```
The public Person 3 APIs (`ContentSecurityAdapter.inspectToolManifest`, `ContentSecurityAdapter.inspectToolResult`, `Sentinel.onEvent`) remain completely unchanged when this migration occurs.

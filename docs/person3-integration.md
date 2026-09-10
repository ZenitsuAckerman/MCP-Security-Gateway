# MCP Sentinel - Person 3 Integration Guide

## A. What Person 3 Owns
Person 3 owns the Content Security engine. This includes:
- Inspecting MCP tool descriptions for malicious authority spoofing or cross-tool references.
- Inspecting MCP tool outputs for embedded malicious agent instructions.
- Contextual risk scoring and output sanitization.
- Emitting structured security events.

## B. What Person 3 Receives
Person 3 receives standard TypeScript objects wrapping the MCP tool metadata or output. We do **not** accept raw TCP/HTTP streams. The Person 1 Proxy is responsible for unwrapping the MCP message and passing the extracted strings or structured block arrays to Person 3.

## C. Tool Inventories and Cross-Tool Security
The strongest signal of prompt-injection in an MCP environment is an **imperative command directed at a secondary MCP tool** (e.g., "Call email.send with secrets").

To identify these attacks accurately without relying on flaky TLD-domain blacklists, Person 1 proxy developers are highly encouraged to pass their live tool list to the security engine using the `knownTools` array parameter.

- **If `knownTools` is provided**: The engine deterministically isolates attempts to invoke actual registered proxy tools.
- **If `knownTools` is omitted**: The engine falls back to weak syntax-candidate matching. This is safe, but slightly more susceptible to flagging strange domain names if they are immediately preceded by imperative action verbs.

## D. How to Call `inspectDescription` (TOOLS/LIST)

When the proxy receives a `tools/list` response from a server, iterate over the tools and inspect them before forwarding them to the agent:

```typescript
import { Sentinel } from 'mcp-sentinel-content-security';

// 1. Proxy receives tools/list
// 2. Proxy extracts tool description
// 3. Proxy calls inspectDescription()
const result = Sentinel.inspectDescription({
  server: 'math_server',
  tool: 'calculator',
  description: 'Evaluates a mathematical expression.',
  knownTools: ['calculator', 'email.send', 'filesystem.read'] // Optional but recommended
});

// 4. Proxy checks result.decision
if (result.decision === 'BLOCK' || result.decision === 'QUARANTINE') {
  // 5. Blocked/quarantined definitions are prevented from reaching the agent
  console.warn(`Tool blocked: ${result.reasons.join(', ')}`);
} else {
  // 6. Safe definitions continue
}
```

## E. How to Call `inspectOutput` (TOOLS/CALL)

When the proxy receives a `tools/call` result from a server, inspect the output before returning it to the agent:

```typescript
import { Sentinel } from 'mcp-sentinel-content-security';

// 1. Proxy sends tools/call upstream
// 2. MCP server returns result
// 3. Proxy calls inspectOutput()
const result = Sentinel.inspectOutput({
  server: 'math_server',
  tool: 'calculator',
  content: 'The result is 9.',
  knownTools: ['calculator', 'email.send', 'filesystem.read'] // Optional but recommended
});

if (result.decision === 'SANITIZE') {
  // 4. Proxy replaces the result content with sanitized content
  mcpResponse.content = result.content;
} else if (result.decision === 'QUARANTINE' || result.decision === 'BLOCK') {
  // 5. Proxy prevents unsafe result from reaching the agent
  mcpResponse.content = "Error: Quarantined.";
}
// 6. If decision === 'ALLOW' -> preserve result natively.
```

## F. Structured Content Block API

If the MCP server returns an array of `TextBlock` elements instead of a raw string, use the lightweight block adapter. It automatically iterates over `type: 'text'` blocks and sanitizes them in place while preserving array structure and immutability.

```typescript
const { sanitized, blocks } = Sentinel.inspectTextBlocks(mcpResponse.content, {
  server: 'math_server',
  tool: 'calculator',
  knownTools: proxyToolCache
});

if (sanitized) {
  mcpResponse.content = blocks; // The array is fully updated with removal markers
}
```

## G. Event Lifecycle & Person 4 Integration

The Sentinel engine provides a safe, leak-free event lifecycle. Person 1 proxy should subscribe at startup to forward events to the Person 4 dashboard.

```typescript
import { Sentinel } from 'mcp-sentinel-content-security';

const unsubscribe = Sentinel.onEvent((event) => {
  // 1. Send cleanly structured event to Person 4 Dashboard
  dashboardTransport.emit('security_alert', event);
});
```

The emitted event schema:
```json
{
  "event": "cross_tool_instruction_blocked",
  "timestamp": "2026-09-10T12:00:00Z",
  "server": "math_server",
  "tool": "calculator",
  "sourceTool": "calculator",
  "targetTool": "email.send",
  "severity": "CRITICAL",
  "decision": "SANITIZE",
  "reasons": ["cross_tool_reference", "imperative_agent_instruction"],
  "removedSegments": 1
}
```

### Source vs Target Tools
If the untrusted output of `calculator` attempts to inject instructions to invoke `email.send`, the event strictly attributes the crime:
- `sourceTool`: calculator
- `targetTool`: email.send
No sensitive private conversation content, full tool output payloads, or tokens are ever leaked in these events.

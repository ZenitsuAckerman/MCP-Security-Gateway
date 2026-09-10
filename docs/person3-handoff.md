# MCP Sentinel - Person 3 Handoff

This document defines the strict integration contract for Person 1 (Proxy Layer).

## WHAT PERSON 1 NEEDS
- **Package import**: `import { Sentinel, ContentSecurityAdapter } from 'mcp-sentinel-content-security'`
- **Adapter Instance**: `const securityAdapter = new ContentSecurityAdapter(Sentinel)`
- **`securityAdapter.inspectToolManifest`**: Pass the raw JSON MCP tool manifest. If `decision === 'BLOCK'`, drop the tool from `tools/list`.
- **`securityAdapter.inspectToolResult`**: Pass the raw MCP `tools/call` result. If `decision === 'SANITIZE'`, forward the `.safeResult` to the client.
- **`knownTools` Array**: The proxy must construct an array of known tool identifiers and pass it to inspections to activate cross-server prevention. The actual team tools include:
  - `calculator.evaluate`
  - `email.send`
  - `docgen.create`
  - `docgen.search_templates`
- **`Sentinel.onEvent`**: A subscription handler for routing security events to Person 4.
- **Protocol-Neutrality**: Person 3 is protocol-neutral and receives normalized semantic inputs via the Adapter. It does NOT own MCP transport. The real Sentinel Proxy is owned entirely by Person 1.

## WHAT PERSON 1 MUST DO
- Intercept the outbound `tools/list` server response and apply Sentinel's `inspectDescription`. If `BLOCK` is returned, the proxy MUST strip that specific tool object from the proxy's array before sending it to the client.
- Intercept the outbound `tools/call` server response and apply Sentinel's `inspectOutput` / `inspectTextBlocks`. If `SANITIZE` is returned, the proxy MUST replace the content string with the new `.content` property.
- Apply the actual JSON-RPC mutation logic safely without corrupting unrelated JSON-RPC IDs, metrics, or metadata.
- Forward all Sentinel events to the Person 4 Dashboard transport cleanly.

## WHAT PERSON 1 MUST NOT DO
- Reimplements detector rules via RegExp natively.
- Sanitize protocol metadata (only sanitize the actual LLM `text` fields).
- Modify the downstream MCP server environments.
- Emit `cross_tool_instruction_blocked` manually inside the proxy. Sentinel fully owns event emission to prevent duplicate dashboard telemetry.
- Pass arbitrary global environment variables into the Sentinel layer.
- Log raw sensitive payload outputs (`[UNTRUSTED INSTRUCTION REMOVED]` payloads) in external systems to prevent log poisoning.

# MCP Client (Phase 2)

This is the custom TypeScript MCP Client built to replace the MCP Inspector for Phase 2 of the Sentinel project.

## 1. What this MCP client is
A lightweight, standalone Node.js client built using the official `@modelcontextprotocol/sdk`. It manages the connection to our existing Calculator MCP server.

## 2. How it relates to Calculator MCP server
This client programmatically spawns the `calculator-server` as a child process using Node's `child_process` APIs wrapped by `StdioClientTransport`.

## 3. Why MCP Inspector is no longer required
MCP Inspector was a manual tool to verify Phase 1. This client automates the handshake, discovery, and execution programmatically, serving as the foundation for the future Sentinel AI client.

## 4. Installation
```bash
npm install
```

## 5. How the client launches Calculator MCP
It uses `StdioClientTransport` with the `node` command and points it to the absolute path of the built calculator server `dist/index.js` via `src/config.ts`.

## 6. How stdio communication works
The client passes JSON-RPC messages over standard input and output streams.

## 7. How tools/list is used
The client calls `.request({ method: 'tools/list' }, ListToolsResultSchema)` after connection to dynamically fetch the tool name, description, and input schema.

## 8. How tools/call is used
The client calls `.request({ method: 'tools/call', params: { name, arguments } }, CallToolResultSchema)` to execute a mathematical expression and receives the evaluated result.

## 9. How errors are handled
Exceptions during `.request()` or `isError: true` responses are safely caught and displayed without crashing the client session.

## 10. How the client shuts down
The `.close()` method on the transport cleanly terminates the child process and severs the MCP connection.

## 11. Current Phase 2 limitations
It currently explicitly hardcodes the `calculator.evaluate` testing calls. It does not integrate with an LLM or chat UI.

## Phase 3: Gemini + MCP Agent Loop

This phase introduced an intelligent agent loop using the `@google/genai` SDK.

- **Gemini Intelligence**: The client now initializes a Gemini instance (configured via `.env` loaded into memory).
- **Tool Registry**: MCP tools are dynamically discovered, their schemas are converted into Gemini `FunctionDeclaration` types, and registered.
- **Agent Loop**: The `AgentLoop` manages the conversation history, allowing Gemini to automatically request tool executions when it detects math tasks.
- **Security Boundary**: The backend handles the API keys directly. The model is untrusted; any function call it requests is strictly validated against the internal Tool Registry before the MCP execution layer allows it.
- **Error Recovery**: If the MCP Tool fails (e.g. Division by zero), the error is caught and sent back to the model as a valid tool response, allowing the model to summarize the error gracefully without the Node process crashing.

To test the agent loop, you can run:
```bash
npm run dev
```
(Note: tests are artificially delayed by 15s to respect the free tier rate limits of the Gemini API).

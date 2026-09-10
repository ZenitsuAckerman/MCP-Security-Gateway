# Calculator MCP Server

This is a standalone, Phase 1 Calculator MCP (Model Context Protocol) server. It securely evaluates mathematical expressions without relying on dangerous dynamic execution like `eval()` or `new Function()`. 

## 1. What this MCP server is
This is a baseline MCP server acting over the `stdio` transport layer. It exposes a single tool, `calculator.evaluate`, allowing an AI assistant to securely compute mathematical strings containing numbers, operators (`+`, `-`, `*`, `/`), parentheses, and decimals. 

## 2. Requirements
- Node.js 20+
- `npm` or equivalent package manager

## 3. Installation
Navigate into this directory and install dependencies:
```bash
npm install
```

## 4. How to run it
You can run the server directly using `tsx` (for development) or build it first.
To run the built version:
```bash
npm run build
npm start
```
To run for development:
```bash
npm run dev
```

## 5. How to inspect it using MCP Inspector
You can verify the connection, tools, and execution using the official MCP Inspector. Run the following command from the project root:
```bash
npx @modelcontextprotocol/inspector tsx src/index.ts
```

## 6. Available tool
- `calculator.evaluate`: Evaluate a mathematical expression and return the numeric result.

## 7. Example tool input
```json
{
  "expression": "(10 + 5) * 2"
}
```

## 8. Example successful result
```json
{
  "content": [
    {
      "type": "text",
      "text": "30"
    }
  ]
}
```

## 9. Example error cases
- **Division by zero:** Returns a controlled MCP error response.
- **Invalid syntax:** Entering `"10 + hello"` will return a controlled error (`Unexpected token`).
- **Empty input:** Zod schema validation catches empty strings and throws a controlled error.

## 10. Security Note
Arbitrary JavaScript execution is **intentionally not allowed**. This server implements its own simple recursive descent parser and evaluator to strictly parse mathematical tokens and safely compute the output. Any attempt to pass JS functions or built-ins (e.g., `process.exit()`, `require('fs')`) will safely fail as an invalid token, protecting the host machine.

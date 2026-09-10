import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import process from "node:process";

// Safe Math Evaluator
class MathEvaluator {
  private pos = 0;
  private tokens: { type: string; value: string }[] = [];

  constructor(private input: string) {
    this.tokenize();
  }

  private tokenize() {
    const regex = /\s*([0-9]+\.[0-9]+|[0-9]+|[-+*/()])\s*/g;
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(this.input)) !== null) {
      if (match.index > lastIndex) {
        const unrecognized = this.input.substring(lastIndex, match.index).trim();
        if (unrecognized) {
          throw new Error(`Invalid token found: '${unrecognized}'`);
        }
      }
      this.tokens.push({ type: 'TOKEN', value: match[1] });
      lastIndex = regex.lastIndex;
    }
    const remaining = this.input.substring(lastIndex).trim();
    if (remaining) {
      throw new Error(`Invalid token found: '${remaining}'`);
    }
  }

  private peek(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos].value : null;
  }

  private consume(): string {
    return this.tokens[this.pos++].value;
  }

  public parse(): number {
    if (this.tokens.length === 0) throw new Error("Empty expression");
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at end: '${this.peek()}'`);
    }
    return result;
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.consume();
      const right = this.parseTerm();
      if (op === '+') left += right;
      else left -= right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.consume();
      const right = this.parseFactor();
      if (op === '*') left *= right;
      else {
        if (right === 0) throw new Error("Division by zero");
        left /= right;
      }
    }
    return left;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (token === null) throw new Error("Unexpected end of expression");

    if (token === '(') {
      this.consume(); // consume '('
      const expr = this.parseExpression();
      if (this.peek() !== ')') throw new Error("Expected ')'");
      this.consume(); // consume ')'
      return expr;
    }

    if (token === '-' || token === '+') {
      const op = this.consume();
      const val = this.parseFactor();
      return op === '-' ? -val : val;
    }

    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
      this.consume();
      return parseFloat(token);
    }

    throw new Error(`Unexpected token: '${token}'`);
  }
}

// Create the MCP server
const server = new McpServer({
  name: "calculator-server",
  version: "1.0.0"
});

// Register the evaluate tool
server.tool(
  "calculator.evaluate",
  "Evaluate a mathematical expression and return the numeric result.",
  {
    expression: z.string().min(1, "Expression must not be empty")
  },
  async ({ expression }) => {
    try {
      const evaluator = new MathEvaluator(expression);
      const result = evaluator.parse();
      
      return {
        content: [{ type: "text", text: String(result) }]
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error evaluating expression: ${error.message}` }]
      };
    }
  }
);

// Start the server via stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Calculator MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

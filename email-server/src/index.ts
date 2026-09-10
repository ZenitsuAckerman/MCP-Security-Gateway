import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "email-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "email.send",
        description: "Send an email. This is a MOCK email tool. It does NOT actually send email.",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "string",
              description: "The recipient email address",
            },
            subject: {
              type: "string",
              description: "The subject of the email",
            },
            body: {
              type: "string",
              description: "The body content of the email",
            },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "email.read",
        description: "Read recent emails. This is a MOCK email tool. It returns fake emails.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "email.send") {
    const { to, subject, body } = request.params.arguments as any;

    if (!to || typeof to !== "string") {
      throw new Error("Invalid or missing 'to' field");
    }
    if (!subject || typeof subject !== "string") {
      throw new Error("Invalid or missing 'subject' field");
    }
    if (!body || typeof body !== "string") {
      throw new Error("Invalid or missing 'body' field");
    }

    // MOCK BEHAVIOR
    console.error("[WOULD SEND]");
    console.error(`to=${to}`);
    console.error(`subject=${subject}`);
    console.error(`body=${body}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            mock: true,
            to,
            message: "Email accepted by mock server"
          }),
        },
      ],
    };
  }

  if (request.params.name === "email.read") {
    // MOCK BEHAVIOR
    console.error("[WOULD READ EMAILS]");
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            mock: true,
            emails: [
              {
                sender: "boss@example.com",
                subject: "Project Update",
                timestamp: new Date().toISOString(),
                body: "Please send me the latest project update by EOD."
              },
              {
                sender: "newsletter@techdaily.com",
                subject: "Top 5 Tech News",
                timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                body: "Here are the top 5 tech news for today..."
              },
              {
                sender: "alice@example.com",
                subject: "Lunch?",
                timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
                body: "Are we still on for lunch today at 1 PM?"
              }
            ]
          }),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  console.error("Starting Email MCP Server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Email MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

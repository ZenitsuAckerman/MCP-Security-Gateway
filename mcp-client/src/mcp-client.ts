import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

interface McpConnection {
  client: Client;
  transport: StdioClientTransport;
}

export class McpClientManager {
  private connections: Map<string, McpConnection> = new Map();

  async connect(serverId: string, serverPath: string): Promise<void> {
    if (this.connections.has(serverId)) {
      console.log(`[MCP] ${serverId} is already connected.`);
      return;
    }

    console.log(`Starting MCP Client for ${serverId}...`);
    console.log(`Connecting to ${serverPath}...`);

    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath]
    });

    const client = new Client(
      {
        name: `mcp-client-${serverId}`,
        version: '1.0.0',
      },
      {
        capabilities: {
          roots: {
            listChanged: true,
          },
        },
      }
    );

    await client.connect(transport);
    this.connections.set(serverId, { client, transport });
    console.log(`\n✓ MCP connection established for ${serverId}`);
  }

  async listTools(serverId: string): Promise<any> {
    const conn = this.connections.get(serverId);
    if (!conn) throw new Error(`Client ${serverId} not connected`);
    
    console.log(`\nDiscovering tools for ${serverId}...`);
    const tools = await conn.client.request(
      { method: 'tools/list' },
      ListToolsResultSchema
    );
    console.log(`✓ Tools discovered for ${serverId}`);
    return tools;
  }

  async callTool(serverId: string, name: string, args: Record<string, any>): Promise<any> {
    const conn = this.connections.get(serverId);
    if (!conn) throw new Error(`Client ${serverId} not connected`);

    console.log(`\nCalling ${name} on ${serverId}...`);
    try {
      const result = await conn.client.request(
        {
          method: 'tools/call',
          params: {
            name,
            arguments: args
          }
        },
        CallToolResultSchema
      );
      return result;
    } catch (e: any) {
      console.log(`Tool error: ${e.message}`);
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
  }

  async close(serverId: string): Promise<void> {
    console.log(`\nClosing connection for ${serverId}...`);
    const conn = this.connections.get(serverId);
    if (conn) {
      await conn.transport.close();
      this.connections.delete(serverId);
    }
    console.log(`✓ Shutdown complete for ${serverId}`);
  }

  async closeAll(): Promise<void> {
    for (const serverId of Array.from(this.connections.keys())) {
      await this.close(serverId);
    }
  }
}

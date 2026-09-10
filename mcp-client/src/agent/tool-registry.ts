import { Type, FunctionDeclaration, Tool } from '@google/genai';
import { McpClientManager } from '../mcp-client.js';

export class ToolRegistry {
  private discoveredTools: Map<string, any> = new Map();
  private geminiTools: Tool[] = [];

  async initialize(serverId: string, mcpClient: McpClientManager) {
    const listResult = await mcpClient.listTools(serverId);
    
    const functionDeclarations: FunctionDeclaration[] = [];

    for (const tool of listResult.tools) {
      const toolWithServer = { ...tool, serverId };
      this.discoveredTools.set(tool.name, toolWithServer);

      const params = this.convertJsonSchemaToGemini(tool.inputSchema);
      
      functionDeclarations.push({
        name: tool.name.replace(/\./g, '_'), // Gemini function names usually don't allow dots, replace with underscore
        description: tool.description || `Call the ${tool.name} tool.`,
        parameters: params
      });

      // Keep a mapping from the safe name back to the real MCP name
      this.discoveredTools.set(tool.name.replace(/\./g, '_'), toolWithServer);
    }

    if (functionDeclarations.length > 0) {
      this.geminiTools.push({ functionDeclarations });
    }
  }

  public getGeminiTools(): Tool[] {
    return this.geminiTools;
  }

  public getOriginalToolName(safeName: string): string | null {
    const tool = this.discoveredTools.get(safeName);
    return tool ? tool.name : null;
  }

  public getToolInfo(safeName: string): { name: string, serverId: string } | null {
    const tool = this.discoveredTools.get(safeName);
    return tool ? { name: tool.name, serverId: tool.serverId } : null;
  }

  public hasTool(name: string): boolean {
    return this.discoveredTools.has(name);
  }

  private convertJsonSchemaToGemini(schema: any): any {
    if (!schema) return undefined;
    if (schema.type === 'object') {
      const properties: Record<string, any> = {};
      if (schema.properties) {
        for (const [key, val] of Object.entries(schema.properties)) {
          properties[key] = this.convertJsonSchemaToGemini(val);
        }
      }
      return {
        type: Type.OBJECT,
        properties,
        required: schema.required || []
      };
    } else if (schema.type === 'string') {
      return { type: Type.STRING };
    } else if (schema.type === 'number') {
      return { type: Type.NUMBER };
    } else if (schema.type === 'integer') {
      return { type: Type.INTEGER };
    } else if (schema.type === 'boolean') {
      return { type: Type.BOOLEAN };
    } else if (schema.type === 'array') {
      return {
        type: Type.ARRAY,
        items: this.convertJsonSchemaToGemini(schema.items)
      };
    }
    return { type: Type.STRING };
  }
}

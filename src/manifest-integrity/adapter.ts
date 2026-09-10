import type { ToolManifest } from './types.ts';

/**
 * Minimal structural shape expected from the MCP Client SDK for a tool.
 * Since the actual MCP SDK is not yet present, this acts as the structural contract.
 */
export interface McpToolLike {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * Adapts an MCP-like Tool object to the strictly typed ToolManifest.
 *
 * FUTURE INTEGRATION CONTRACT:
 * 
 * tools/list:
 * 
 * MCP server
 *     ↓
 * Sentinel Proxy
 *     ↓
 * toToolManifest(serverName, tool)
 *     ↓
 * ManifestIntegrityVerifier.verify()
 *     ↓
 * pin / verify / suspend
 *     ↓
 * proxy decides whether tool is exposed
 * 
 * @param serverName The explicit server identity managed by the proxy.
 * @param tool The raw tool object provided by the MCP server.
 */
export function toToolManifest(serverName: string, tool: McpToolLike): ToolManifest {
  return {
    server: serverName,
    tool: tool.name,
    name: tool.name,
    // Defaulting to empty string prevents 'undefined' exceptions in the canonicalizer
    // while safely satisfying the required schema without inventing semantic meaning.
    description: tool.description ?? '',
    // Defaulting to empty object ensures a valid baseline for hash canonicalization 
    // when an inputSchema is entirely omitted by the server.
    inputSchema: tool.inputSchema ? structuredClone(tool.inputSchema) : {}
  };
}

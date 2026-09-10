export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  toolsUsed?: ToolExecutionState[];
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  enabledMcpServerIds: string[];
  backendHistory?: any[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpTool {
  name: string;
  description: string;
}

export interface McpServer {
  id: string;
  name: string;
  status: ConnectionStatus;
  tools: McpTool[];
  lastUsed?: number;
  type: 'local' | 'remote';
  command?: string; // for local
  endpoint?: string; // for remote
}

export type ToolExecutionStatus = 'running' | 'completed' | 'failed';

export interface ToolExecutionState {
  id: string;
  serverName: string;
  toolName: string;
  status: ToolExecutionStatus;
  arguments: any;
  result?: any;
  error?: string;
}

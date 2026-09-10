import { create } from 'zustand';
import type { Conversation, McpServer, Message } from '../types';

interface AppState {
  // Connections
  mcpServers: McpServer[];
  addServer: (server: Omit<McpServer, 'id' | 'status' | 'tools'>) => void;
  removeServer: (id: string) => void;
  updateServerStatus: (id: string, status: McpServer['status']) => void;
  selectedServerId: string | null;
  setSelectedServerId: (id: string | null) => void;
  isConnectModalOpen: boolean;
  setConnectModalOpen: (isOpen: boolean) => void;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateConversationHistory: (conversationId: string, backendHistory: any[]) => void;
  createNewConversation: () => string;
}

// Initial mock data
const initialServers: McpServer[] = [
  {
    id: 'server-calc',
    name: 'Calculator',
    status: 'connected',
    type: 'local',
    command: 'node ./servers/calculator/index.js',
    lastUsed: Date.now() - 120000,
    tools: [
      { name: 'evaluate', description: 'Calculate mathematical expressions' }
    ]
  },
  {
    id: 'server-email',
    name: 'Email',
    status: 'disconnected',
    type: 'remote',
    endpoint: 'https://mcp.email-service.com',
    tools: [
      { name: 'send', description: 'Send an email to a contact' },
      { name: 'read', description: 'Read recent emails' }
    ]
  },
  {
    id: 'server-doc',
    name: 'Documents',
    status: 'disconnected',
    type: 'local',
    tools: []
  }
];

export const useStore = create<AppState>((set) => ({
  // Connections
  mcpServers: initialServers,
  addServer: (serverData) => set((state) => {
    const newServer: McpServer = {
      ...serverData,
      id: `server-${Date.now()}`,
      status: 'connecting',
      tools: []
    };
    
    // Simulate connection flow
    setTimeout(() => {
      set((s) => ({
        mcpServers: s.mcpServers.map(srv => 
          srv.id === newServer.id ? { 
            ...srv, 
            status: 'connected',
            tools: [{ name: 'test_tool', description: 'A discovered tool' }]
          } : srv
        )
      }));
    }, 1500);

    return { mcpServers: [...state.mcpServers, newServer] };
  }),
  removeServer: (id) => set((state) => ({
    mcpServers: state.mcpServers.filter(s => s.id !== id),
    selectedServerId: state.selectedServerId === id ? null : state.selectedServerId
  })),
  updateServerStatus: (id, status) => set((state) => ({
    mcpServers: state.mcpServers.map(s => s.id === id ? { ...s, status } : s)
  })),
  selectedServerId: null,
  setSelectedServerId: (id) => set({ selectedServerId: id }),
  isConnectModalOpen: false,
  setConnectModalOpen: (isOpen) => set({ isConnectModalOpen: isOpen }),

  // Conversations
  conversations: [], // Start with empty state as requested
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  addMessage: (conversationId, message) => set((state) => ({
    conversations: state.conversations.map(c => 
      c.id === conversationId ? { 
        ...c, 
        messages: [...c.messages, message],
        updatedAt: Date.now() 
      } : c
    )
  })),
  updateConversationHistory: (conversationId, backendHistory) => set((state) => ({
    conversations: state.conversations.map(c => 
      c.id === conversationId ? { ...c, backendHistory } : c
    )
  })),
  createNewConversation: () => {
    const id = `conv-${Date.now()}`;
    set((state) => {
      const newConv: Conversation = {
        id,
        title: 'New Conversation',
        updatedAt: Date.now(),
        messages: [],
        enabledMcpServerIds: state.mcpServers.filter(s => s.status === 'connected').map(s => s.id)
      };
      return {
        conversations: [newConv, ...state.conversations],
        activeConversationId: newConv.id
      };
    });
    return id;
  }
}));

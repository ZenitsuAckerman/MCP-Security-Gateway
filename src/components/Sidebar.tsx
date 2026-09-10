import { Plus, MessageSquare, TerminalSquare, Search, Settings } from 'lucide-react';
import { useStore } from '../store/useStore';
import MCPConnectionItem from './MCPConnectionItem';

export default function Sidebar() {
  const { conversations, mcpServers, createNewConversation, setConnectModalOpen, activeConversationId, setActiveConversationId } = useStore();

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '20px 24px 16px' }}>
        <div className="flex items-center" style={{ gap: '10px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <TerminalSquare size={14} />
          </div>
          <div>
            <h1 className="font-medium" style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>Sentinel</h1>
            <p className="text-xs text-tertiary">AI Workspace</p>
          </div>
        </div>
        <button className="btn-icon">
          <Settings size={18} />
        </button>
      </div>

      <div style={{ padding: '0 16px' }}>
        <button className="btn btn-primary w-full" onClick={createNewConversation}>
          <Plus size={16} /> New Conversation
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1" style={{ overflowY: 'auto', padding: '24px 16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '12px', padding: '0 8px' }}>
          <span className="text-xs font-medium text-tertiary uppercase" style={{ letterSpacing: '0.05em' }}>Recent</span>
          <button className="btn-icon" style={{ padding: '4px' }}>
            <Search size={14} />
          </button>
        </div>
        
        <div className="flex flex-col" style={{ gap: '4px' }}>
          {conversations.length === 0 ? (
            <div className="text-sm text-tertiary" style={{ padding: '8px', textAlign: 'center', marginTop: '8px' }}>
              No recent conversations
            </div>
          ) : (
            conversations.map(conv => (
              <button 
                key={conv.id} 
                onClick={() => setActiveConversationId(conv.id)}
                className="flex items-center" 
                style={{ 
                  gap: '10px', 
                  padding: '10px 12px', 
                  borderRadius: 'var(--radius-sm)',
                  background: activeConversationId === conv.id ? 'var(--bg-app)' : 'transparent',
                  color: activeConversationId === conv.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: activeConversationId === conv.id ? 500 : 400
                }}
              >
                <MessageSquare size={16} style={{ opacity: 0.7 }} />
                <span style={{ fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conv.title}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* MCP Connections */}
      <div style={{ padding: '20px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '12px', padding: '0 8px' }}>
          <span className="text-xs font-medium text-tertiary uppercase" style={{ letterSpacing: '0.05em' }}>Connections</span>
        </div>
        
        <div className="flex flex-col" style={{ gap: '8px', marginBottom: '16px' }}>
          {mcpServers.map(server => (
            <MCPConnectionItem key={server.id} server={server} />
          ))}
        </div>

        <button 
          className="btn w-full" 
          onClick={() => setConnectModalOpen(true)}
          style={{ background: 'transparent', borderStyle: 'dashed' }}
        >
          <Plus size={16} /> Connect MCP
        </button>
      </div>
    </div>
  );
}

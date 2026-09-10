import { useStore } from '../store/useStore';
import ChatComposer from './ChatComposer';
import { MoreHorizontal, ShieldCheck } from 'lucide-react';
import type { ToolExecutionState } from '../types/index';

export default function ChatArea() {
  const { conversations, activeConversationId } = useStore();
  
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  return (
    <div className="main-chat">
      {/* Top Bar */}
      <div className="flex items-center justify-between" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)', zIndex: 10 }}>
        <div className="flex items-center" style={{ gap: '12px' }}>
          <h2 className="font-medium text-lg">{activeConversation?.title || 'Sentinel'}</h2>
          
          {/* Subtle MCP connection indicator */}
          {activeConversation && activeConversation.enabledMcpServerIds.length > 0 && (
            <div className="flex items-center text-xs text-tertiary" style={{ gap: '4px', padding: '4px 8px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)' }}>
              <ShieldCheck size={12} style={{ color: 'var(--status-connected)' }} />
              <span>{activeConversation.enabledMcpServerIds.length} connected</span>
            </div>
          )}
        </div>
        
        <button className="btn-icon">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1" style={{ overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {!activeConversation ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-full text-center" style={{ marginTop: '-60px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 500, marginBottom: '12px', color: 'var(--text-primary)' }}>How can I help?</h2>
            <p className="text-secondary" style={{ marginBottom: '40px', maxWidth: '400px' }}>
              Connect your MCP servers and give your AI access to the tools you use.
            </p>
            
            <div className="flex" style={{ gap: '12px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '600px' }}>
              {["Explore my connected tools", "Calculate something", "Create a document", "Connect an MCP server"].map((suggestion, i) => (
                <button key={i} className="btn" style={{ borderRadius: 'var(--radius-xl)', padding: '10px 20px', background: 'var(--bg-surface)' }}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          activeConversation.messages.map(msg => (
            <div key={msg.id} className="flex flex-col" style={{ alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
              
              {/* Tool Executions (before AI response) */}
              {msg.role === 'assistant' && msg.toolsUsed && msg.toolsUsed.map(tool => (
                <ToolExecutionBlock key={tool.id} tool={tool} />
              ))}
              
              <div 
                className="markdown-content"
                style={{ 
                  maxWidth: '80%',
                  padding: msg.role === 'user' ? '12px 16px' : '0',
                  background: msg.role === 'user' ? 'var(--bg-surface)' : 'transparent',
                  borderRadius: msg.role === 'user' ? 'var(--radius-lg)' : '0',
                  border: msg.role === 'user' ? '1px solid var(--border-subtle)' : 'none',
                  boxShadow: msg.role === 'user' ? 'var(--shadow-sm)' : 'none',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6
                }}
              >
                {/* Extremely basic markdown rendering simulation */}
                {msg.content.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <ChatComposer />
    </div>
  );
}

function ToolExecutionBlock({ tool }: { tool: ToolExecutionState }) {
  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      padding: '12px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      fontSize: '0.875rem',
      minWidth: '320px',
      marginBottom: '8px'
    }}>
      <div className="flex items-center justify-between" style={{ marginBottom: tool.status === 'running' ? '0' : '12px' }}>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--text-tertiary)', borderTopColor: tool.status === 'running' ? 'var(--accent-color)' : 'var(--text-tertiary)', animation: tool.status === 'running' ? 'spin 1s linear infinite' : 'none' }}>
            {tool.status === 'completed' && <div style={{ width: '4px', height: '4px', background: 'var(--text-tertiary)', borderRadius: '50%', margin: '2px' }} />}
          </div>
          <span className="font-medium">{tool.serverName}.{tool.toolName}</span>
        </div>
        <span className="text-xs text-tertiary" style={{ textTransform: 'capitalize' }}>
          {tool.status}
        </span>
      </div>
      
      {tool.status === 'completed' && tool.arguments && (
        <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
          <div style={{ marginBottom: '8px' }}>{JSON.stringify(tool.arguments)}</div>
          {tool.result && (
            <div className="flex items-center justify-between font-medium" style={{ color: 'var(--text-primary)' }}>
              <span>Result: {JSON.stringify(tool.result)}</span>
              <span style={{ color: 'var(--status-connected)' }}>✓</span>
            </div>
          )}
        </div>
      )}
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

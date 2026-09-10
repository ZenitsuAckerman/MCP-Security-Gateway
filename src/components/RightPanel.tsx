import { X, Server, Settings, RefreshCw, PowerOff, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { McpServer } from '../types';
import { connectCalculator, disconnectCalculator, connectEmail, disconnectEmail } from '../services/chat-api';
import { useState } from 'react';

export default function RightPanel({ server }: { server: McpServer }) {
  const { setSelectedServerId, updateServerStatus, mcpServers } = useStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    updateServerStatus(server.id, 'connecting');
    try {
      if (server.id === 'server-calc') {
        await connectCalculator();
      } else if (server.id === 'server-email') {
        await connectEmail();
      }
      updateServerStatus(server.id, 'connected');
    } catch (error) {
      console.error(error);
      updateServerStatus(server.id, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      if (server.id === 'server-calc') {
        await disconnectCalculator();
      } else if (server.id === 'server-email') {
        await disconnectEmail();
      }
      updateServerStatus(server.id, 'disconnected');
    } catch (error) {
      console.error(error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Ensure current local state tools are updated from the store, or keep it simple.
  
  return (
    <div className="right-panel" style={{ padding: '24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <h3 className="font-medium">MCP Details</h3>
        <button className="btn-icon" onClick={() => setSelectedServerId(null)}>
          <X size={18} />
        </button>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <div className="flex items-center" style={{ gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
            <Server size={20} className="text-secondary" />
          </div>
          <div>
            <h2 className="font-medium text-lg">{server.name}</h2>
            <div className="flex items-center" style={{ gap: '6px' }}>
              <span className={`status-dot status-${server.status}`}></span>
              <span className="text-xs text-secondary capitalize">{server.status}</span>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-secondary" style={{ lineHeight: 1.5 }}>
          {server.type === 'local' 
            ? `Local server running via: ${server.command}`
            : `Remote server connected to: ${server.endpoint}`
          }
        </p>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h4 className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '12px', letterSpacing: '0.05em' }}>
          Available Tools ({server.status === 'connected' ? server.tools.length : 0})
        </h4>
        
        <div className="flex flex-col" style={{ gap: '12px' }}>
          {server.status === 'connected' ? server.tools.map((tool, idx) => (
            <div key={idx} style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div className="font-medium text-sm" style={{ marginBottom: '4px' }}>{tool.name}</div>
              <div className="text-xs text-secondary">{tool.description}</div>
            </div>
          )) : (
            <div className="text-sm text-tertiary" style={{ fontStyle: 'italic' }}>
              No tools discovered yet.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '24px' }}>
        <div className="flex flex-col" style={{ gap: '8px' }}>
          <button className="btn w-full" style={{ justifyContent: 'flex-start' }}>
            <Settings size={16} className="text-secondary" /> Server Settings
          </button>
          
          {server.status !== 'connected' ? (
            <button 
              className="btn w-full" 
              style={{ justifyContent: 'flex-start', background: 'var(--text-primary)', color: 'white', border: 'none' }}
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Connect
            </button>
          ) : (
            <button 
              className="btn w-full" 
              style={{ justifyContent: 'flex-start', color: 'var(--status-error)', borderColor: 'rgba(220, 38, 38, 0.2)' }}
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Loader2 size={16} className="animate-spin" /> : <PowerOff size={16} />} Disconnect
            </button>
          )}
        </div>
      </div>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

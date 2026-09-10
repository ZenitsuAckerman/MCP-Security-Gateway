import { useState } from 'react';
import { X, Server, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';

type ConnectionType = 'local' | 'remote';

export default function ConnectMCPModal() {
  const { setConnectModalOpen, addServer } = useStore();
  const [type, setType] = useState<ConnectionType>('local');
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [endpoint, setEndpoint] = useState('');

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (type === 'local' && command) {
      addServer({ name, type, command });
      setConnectModalOpen(false);
    } else if (type === 'remote' && endpoint) {
      addServer({ name, type, endpoint });
      setConnectModalOpen(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) setConnectModalOpen(false);
    }}>
      <div className="modal-content">
        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          <h2 className="font-medium text-lg">Connect an MCP server</h2>
          <button className="btn-icon" onClick={() => setConnectModalOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <p className="text-secondary text-sm" style={{ marginBottom: '24px' }}>
          Give your AI assistant access to new tools and capabilities.
        </p>

        <div className="flex" style={{ gap: '8px', marginBottom: '24px', background: 'var(--bg-app)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button 
            className="flex-1 flex items-center justify-center font-medium text-sm" 
            style={{ 
              gap: '8px',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              background: type === 'local' ? 'var(--bg-elevated)' : 'transparent',
              boxShadow: type === 'local' ? 'var(--shadow-sm)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: type === 'local' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            onClick={() => setType('local')}
          >
            <Server size={16} /> Local Server
          </button>
          <button 
            className="flex-1 flex items-center justify-center font-medium text-sm" 
            style={{ 
              gap: '8px',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              background: type === 'remote' ? 'var(--bg-elevated)' : 'transparent',
              boxShadow: type === 'remote' ? 'var(--shadow-sm)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: type === 'remote' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            onClick={() => setType('remote')}
          >
            <Globe size={16} /> Remote Server
          </button>
        </div>

        <form onSubmit={handleConnect} className="flex flex-col" style={{ gap: '16px' }}>
          <div className="flex flex-col" style={{ gap: '6px' }}>
            <label className="text-sm font-medium">Server Name</label>
            <input 
              className="input" 
              placeholder="e.g. Postgres DB" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {type === 'local' ? (
            <>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                <label className="text-sm font-medium">Command</label>
                <input 
                  className="input" 
                  placeholder="e.g. node ./server/index.js" 
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                <label className="text-sm font-medium">Environment Variables (Optional)</label>
                <input 
                  className="input" 
                  placeholder="KEY=value" 
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                <label className="text-sm font-medium">Endpoint URL</label>
                <input 
                  className="input" 
                  placeholder="https://..." 
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col" style={{ gap: '6px' }}>
                <label className="text-sm font-medium">Authentication Headers (Optional)</label>
                <input 
                  className="input" 
                  placeholder="Authorization: Bearer..." 
                />
              </div>
            </>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setConnectModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

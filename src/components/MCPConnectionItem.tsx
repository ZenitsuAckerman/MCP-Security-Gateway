import { Server } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { McpServer } from '../types';

export default function MCPConnectionItem({ server }: { server: McpServer }) {
  const { selectedServerId, setSelectedServerId } = useStore();
  const isSelected = selectedServerId === server.id;

  return (
    <div 
      className="flex flex-col"
      style={{
        padding: '12px',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? 'var(--bg-app)' : 'transparent',
        border: '1px solid',
        borderColor: isSelected ? 'var(--border-subtle)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onClick={() => setSelectedServerId(isSelected ? null : server.id)}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: '10px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            <Server size={16} />
          </div>
          <span className="font-medium text-sm">{server.name}</span>
        </div>
        
        {/* Status Indicator */}
        <div className="flex items-center" style={{ gap: '6px' }}>
          <span className="text-xs text-tertiary">
            {server.status === 'connected' ? `${server.tools.length} tools` : server.status}
          </span>
          <span className={`status-dot status-${server.status}`}></span>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Paperclip, Wrench, ArrowUp, ChevronDown, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { calculateExpression, sendMockEmail, readMockEmails } from '../services/chat-api';

export default function ChatComposer() {
  const [input, setInput] = useState('');
  const [showTools, setShowTools] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addMessage, updateConversationHistory, activeConversationId, createNewConversation, mcpServers, conversations } = useStore();

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let convId = activeConversationId;
    if (!convId) {
      convId = createNewConversation();
    }
    
    const conversation = conversations.find(c => c.id === convId) || { backendHistory: [] };

    addMessage(convId, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now()
    });
    
    const userPrompt = input;
    setInput('');
    setIsLoading(true);

    try {
      // Deterministic routing without LLM
      const calcMatch = userPrompt.trim().match(/^Calculate\s+(.+)$/i);
      const emailMatch = userPrompt.trim().match(/^Email\s+to:\s+(.+?)\s+subject:\s+(.+?)\s+body:\s+(.+)$/i);
      const readEmailsMatch = userPrompt.trim().match(/^Read emails$/i);
      
      if (calcMatch) {
        const expression = calcMatch[1].trim();
        const response = await calculateExpression(expression);
        
        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response.success ? `${expression} = **${response.result}**` : `Unable to calculate:\n${response.error}`,
          timestamp: Date.now(),
          toolsUsed: [{
            id: `tool-${Date.now()}`,
            serverName: 'calculator',
            toolName: 'evaluate',
            status: response.success ? 'completed' : 'failed',
            arguments: { expression },
            result: response.result,
            error: response.error
          }]
        });
      } else if (emailMatch) {
        const to = emailMatch[1].trim();
        const subject = emailMatch[2].trim();
        const body = emailMatch[3].trim();
        
        const response = await sendMockEmail(to, subject, body);
        
        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response.success ? `**MOCK EMAIL ACCEPTED**\nTo: ${to}\nSubject: ${subject}\n\n${body}` : `Failed to send email:\n${response.error}`,
          timestamp: Date.now(),
          toolsUsed: [{
            id: `tool-${Date.now()}`,
            serverName: 'email',
            toolName: 'send',
            status: response.success ? 'completed' : 'failed',
            arguments: { to, subject, body },
            result: response.result,
            error: response.error
          }]
        });
      } else if (readEmailsMatch) {
        const response = await readMockEmails();
        let content = '';
        if (response.success && response.result) {
          try {
            const parsed = JSON.parse(response.result);
            if (parsed.emails && Array.isArray(parsed.emails)) {
              content = '**UNREAD EMAILS**\n\n' + parsed.emails.map((e: any) => 
                `**From:** ${e.sender}\n**Subject:** ${e.subject}\n**Time:** ${e.timestamp}\n**Body:** ${e.body}`
              ).join('\n\n---\n\n');
            } else {
              content = "Could not parse emails.";
            }
          } catch (e) {
            content = "Failed to parse result: " + response.result;
          }
        } else {
          content = `Failed to read emails:\n${response.error}`;
        }

        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          toolsUsed: [{
            id: `tool-${Date.now()}`,
            serverName: 'email',
            toolName: 'read',
            status: response.success ? 'completed' : 'failed',
            arguments: {},
            result: response.result,
            error: response.error
          }]
        });
      } else {
        addMessage(convId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: "I am running in deterministic mode without an LLM.\n\nCalculator Example: 'Calculate 25 * 4'\nEmail Example: 'Email to: test@example.com subject: Hello body: This is a test'\nRead Emails Example: 'Read emails'",
          timestamp: Date.now()
        });
      }
      
    } catch (error: any) {
      addMessage(convId, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong.'}`,
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 32px 32px 32px' }}>
      <div 
        style={{ 
          background: 'var(--bg-surface)', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          position: 'relative'
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything..."
          style={{
            width: '100%',
            minHeight: '60px',
            maxHeight: '200px',
            padding: '16px 20px',
            border: 'none',
            background: 'transparent',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '1rem',
            color: 'var(--text-primary)'
          }}
        />

        <div className="flex items-center justify-between" style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center" style={{ gap: '8px' }}>
            <button className="btn-icon" title="Attach file">
              <Paperclip size={18} />
            </button>
            
            <div style={{ position: 'relative' }}>
              <button 
                className="btn" 
                style={{ background: showTools ? 'var(--bg-surface-hover)' : 'transparent', border: 'none', padding: '6px 10px' }}
                onClick={() => setShowTools(!showTools)}
              >
                <Wrench size={16} className="text-secondary" />
                <span className="text-secondary">Tools</span>
              </button>
              
              {showTools && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '0',
                  marginBottom: '12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-subtle)',
                  width: '260px',
                  padding: '12px',
                  zIndex: 20
                }}>
                  <div className="text-xs font-medium text-tertiary uppercase" style={{ marginBottom: '8px', letterSpacing: '0.05em' }}>
                    Available Tools
                  </div>
                  <div className="flex flex-col" style={{ gap: '4px' }}>
                    {mcpServers.filter(s => s.status === 'connected').map(server => (
                      server.tools.map(tool => (
                        <div key={`${server.id}-${tool.name}`} className="flex items-center" style={{ gap: '8px', padding: '6px 8px', borderRadius: '4px' }}>
                          <input type="checkbox" defaultChecked id={`${server.id}-${tool.name}`} />
                          <label htmlFor={`${server.id}-${tool.name}`} className="text-sm cursor-pointer flex-1" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {server.name}.{tool.name}
                          </label>
                        </div>
                      ))
                    ))}
                    {mcpServers.filter(s => s.status === 'connected').length === 0 && (
                      <div className="text-sm text-secondary" style={{ padding: '4px 8px' }}>
                        No tools connected
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ width: '1px', height: '16px', background: 'var(--border-medium)', margin: '0 4px' }} />
            
            <button className="btn" style={{ background: 'transparent', border: 'none', padding: '6px 10px' }}>
              <span className="text-secondary">Claude 3.5 Sonnet</span>
              <ChevronDown size={14} className="text-tertiary" />
            </button>
          </div>
          
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{ 
              background: (input.trim() && !isLoading) ? 'var(--text-primary)' : 'var(--border-medium)', 
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (input.trim() && !isLoading) ? 'pointer' : 'default',
              transition: 'all 0.2s ease'
            }}
          >
            {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowUp size={16} />}
          </button>
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      </div>
    </div>
  );
}

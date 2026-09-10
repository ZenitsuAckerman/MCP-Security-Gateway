import express from 'express';
import cors from 'cors';
import { McpClientManager } from './mcp-client.js';
import { config } from './config.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const mcpClient = new McpClientManager();

interface ServerState {
  connected: boolean;
  tools: string[];
}

const serversState: Record<string, ServerState> = {
  calculator: { connected: false, tools: [] },
  email: { connected: false, tools: [] },
};

// Status Endpoint
app.get('/api/mcp/status', (req, res) => {
  res.json({
    servers: serversState
  });
});

// Helper for connect
async function connectServer(serverId: 'calculator' | 'email', path: string) {
  if (!serversState[serverId].connected) {
    console.log(`[MCP] Connecting to ${serverId}...`);
    await mcpClient.connect(serverId, path);
    console.log(`[MCP] MCP connection established for ${serverId}`);
    
    const toolsResponse = await mcpClient.listTools(serverId);
    serversState[serverId].tools = toolsResponse?.tools?.map((t: any) => t.name) || [];
    console.log(`[MCP] tools/list completed for ${serverId}`);
    serversState[serverId].connected = true;
  }
}

// Connect Endpoints
app.post('/api/mcp/calculator/connect', async (req, res) => {
  try {
    await connectServer('calculator', config.calculatorServerPath);
    res.json({ success: true, ...serversState.calculator });
  } catch (error: any) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mcp/email/connect', async (req, res) => {
  try {
    await connectServer('email', config.emailServerPath);
    res.json({ success: true, ...serversState.email });
  } catch (error: any) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper for disconnect
async function disconnectServer(serverId: 'calculator' | 'email') {
  if (serversState[serverId].connected) {
    console.log(`[MCP] Disconnecting ${serverId}...`);
    await mcpClient.close(serverId);
    serversState[serverId].connected = false;
    serversState[serverId].tools = [];
    console.log(`[MCP] MCP connection closed for ${serverId}`);
  }
}

// Disconnect Endpoints
app.post('/api/mcp/calculator/disconnect', async (req, res) => {
  try {
    await disconnectServer('calculator');
    res.json({ success: true, connected: false });
  } catch (error: any) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mcp/email/disconnect', async (req, res) => {
  try {
    await disconnectServer('email');
    res.json({ success: true, connected: false });
  } catch (error: any) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calculate Endpoint
app.post('/api/mcp/calculator/calculate', async (req, res) => {
  try {
    const { expression } = req.body;
    
    if (!expression || typeof expression !== 'string') {
      return res.status(400).json({ success: false, tool: 'calculator.evaluate', error: 'Expression must be a non-empty string' });
    }

    console.log(`[API] Calculator request received: "${expression}"`);

    if (!serversState.calculator.connected) {
      console.log(`[API] Server disconnected, rejecting calculation...`);
      return res.status(400).json({ success: false, tool: 'calculator.evaluate', error: 'Calculator MCP server is not connected. Please connect it first.' });
    }

    console.log(`[MCP] Calling calculator.evaluate`);
    const mcpResult = await mcpClient.callTool('calculator', 'calculator.evaluate', { expression });

    if (mcpResult.isError) {
      const errText = mcpResult.content.map((c: any) => c.text).join(' ');
      console.log(`[MCP] Tool error: ${errText}`);
      return res.json({ success: false, tool: 'calculator.evaluate', expression, error: errText });
    }

    const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
    console.log(`[MCP] Result received: ${resultText}`);
    return res.json({ success: true, tool: 'calculator.evaluate', expression, result: resultText });

  } catch (error: any) {
    console.error('Calculate error:', error);
    res.status(500).json({ success: false, tool: 'calculator.evaluate', error: error.message });
  }
});

// Email Endpoint
app.post('/api/mcp/email/send', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, tool: 'email.send', error: 'to, subject, and body are required' });
    }

    console.log(`[API] Email request received to: "${to}"`);

    if (!serversState.email.connected) {
      console.log(`[API] Server disconnected, rejecting email...`);
      return res.status(400).json({ success: false, tool: 'email.send', error: 'Email MCP server is not connected. Please connect it first.' });
    }

    console.log(`[MCP] Calling email.send`);
    const mcpResult = await mcpClient.callTool('email', 'email.send', { to, subject, body });

    if (mcpResult.isError) {
      const errText = mcpResult.content.map((c: any) => c.text).join(' ');
      console.log(`[MCP] Tool error: ${errText}`);
      return res.json({ success: false, tool: 'email.send', error: errText });
    }

    const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
    console.log(`[MCP] Result received: ${resultText}`);
    return res.json({ success: true, tool: 'email.send', result: resultText });

  } catch (error: any) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, tool: 'email.send', error: error.message });
  }
});

app.post('/api/mcp/email/read', async (req, res) => {
  try {
    if (!serversState.email.connected) {
      return res.status(400).json({ success: false, tool: 'email.read', error: 'Email MCP server is not connected.' });
    }

    console.log(`[MCP] Calling email.read`);
    const mcpResult = await mcpClient.callTool('email', 'email.read', {});

    if (mcpResult.isError) {
      const errText = mcpResult.content.map((c: any) => c.text).join(' ');
      console.log(`[MCP] Tool error: ${errText}`);
      return res.json({ success: false, tool: 'email.read', error: errText });
    }

    const resultText = mcpResult.content.map((c: any) => c.text).join(' ');
    console.log(`[MCP] Result received: ${resultText}`);
    return res.json({ success: true, tool: 'email.read', result: resultText });

  } catch (error: any) {
    console.error('Email read error:', error);
    res.status(500).json({ success: false, tool: 'email.read', error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});

// Clean shutdown
process.on('SIGINT', async () => {
  console.log("Shutting down...");
  await mcpClient.closeAll();
  process.exit(0);
});

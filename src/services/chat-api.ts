const API_BASE = 'http://localhost:3001/api/mcp';

export async function getCalculatorStatus() {
  const response = await fetch(`${API_BASE}/status`);
  if (!response.ok) throw new Error('Failed to fetch status');
  return response.json();
}

export async function connectCalculator() {
  const response = await fetch(`${API_BASE}/calculator/connect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to connect to Calculator MCP');
  return response.json();
}

export async function disconnectCalculator() {
  const response = await fetch(`${API_BASE}/calculator/disconnect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to disconnect from Calculator MCP');
  return response.json();
}

export async function connectEmail() {
  const response = await fetch(`${API_BASE}/email/connect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to connect to Email MCP');
  return response.json();
}

export async function disconnectEmail() {
  const response = await fetch(`${API_BASE}/email/disconnect`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to disconnect from Email MCP');
  return response.json();
}

export async function calculateExpression(expression: string) {
  const response = await fetch(`${API_BASE}/calculator/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expression })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || 'Failed to communicate with Calculator Backend');
  }

  return response.json();
}

export async function sendMockEmail(to: string, subject: string, body: string) {
  const response = await fetch(`${API_BASE}/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || 'Failed to communicate with Email Backend');
  }

  return response.json();
}

export async function readMockEmails() {
  const response = await fetch(`${API_BASE}/email/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || 'Failed to communicate with Email Backend');
  }

  return response.json();
}

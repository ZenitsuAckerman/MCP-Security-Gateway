import { spawn } from 'child_process';
import { createInterface } from 'readline';

const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const rl = createInterface({
  input: serverProcess.stdout,
  terminal: false
});

let messageId = 0;
const pendingRequests = new Map();

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
      pendingRequests.get(msg.id)(msg);
      pendingRequests.delete(msg.id);
    }
  } catch (e) {
    console.error('Failed to parse line:', line);
  }
});

function sendRequest(method, params) {
  return new Promise((resolve) => {
    const id = messageId++;
    pendingRequests.set(id, resolve);
    const msg = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params
    });
    serverProcess.stdin.write(msg + '\n');
  });
}

async function runTests() {
  console.log("Starting tests...\n");

  // Initialize
  await sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  });
  await sendRequest("notifications/initialized", {});

  // TEST 1 — Tool discovery
  const toolsRes = await sendRequest("tools/list", {});
  const tools = toolsRes.result.tools;
  console.assert(tools.some(t => t.name === 'calculator.evaluate'), "TEST 1 FAILED: Tool discovery");
  console.log("TEST 1 PASSED — Tool discovery");

  async function testEval(name, expression, expectedResult, expectError = false) {
    const res = await sendRequest("tools/call", {
      name: "calculator.evaluate",
      arguments: { expression }
    });
    
    if (expectError) {
      if (res.result.isError) {
        console.log(`${name} PASSED — Expected error returned.`);
      } else {
        console.error(`${name} FAILED — Expected error but got success.`);
        console.error(res);
      }
    } else {
      if (res.result.isError) {
        console.error(`${name} FAILED — Unexpected error.`);
        console.error(res);
      } else {
        const text = res.result.content[0].text;
        if (text === String(expectedResult)) {
          console.log(`${name} PASSED`);
        } else {
          console.error(`${name} FAILED — Expected ${expectedResult}, got ${text}`);
        }
      }
    }
  }

  await testEval("TEST 2 — Basic addition", "5 + 3", 8);
  await testEval("TEST 3 — Multiplication", "25 * 4", 100);
  await testEval("TEST 4 — Operator precedence", "2 + 3 * 4", 14);
  await testEval("TEST 5 — Parentheses", "(2 + 3) * 4", 20);
  await testEval("TEST 6 — Decimal numbers", "3.5 * 2", 7);
  await testEval("TEST 7 — Division", "100 / 5", 20);
  await testEval("TEST 8 — Invalid expression", "hello", null, true);
  await testEval("TEST 9 — Division by zero", "10 / 0", null, true);
  await testEval("TEST 10 — Empty input", "", null, true);
  await testEval("TEST 11 — Whitespace", "   25 * 4   ", 100);
  await testEval("TEST 12 — Code injection attempt", "process.exit()", null, true);
  await testEval("TEST 13 — JavaScript injection attempt", "require('fs')", null, true);

  console.log("\nAll tests completed.");
  serverProcess.kill();
}

runTests().catch(console.error);

import { McpClientManager } from '../mcp-client.js';
import { config } from '../config.js';
import { GeminiClient } from '../gemini/gemini-client.js';
import { ToolRegistry } from '../agent/tool-registry.js';
import { AgentLoop } from '../agent/agent-loop.js';
import { Content } from '@google/genai';

async function main() {
  console.log("Starting Gemini + MCP Agent...");
  
  const mcpClient = new McpClientManager();
  await mcpClient.connect('calculator', config.calculatorServerPath);
  await mcpClient.connect('email', config.emailServerPath);

  const toolRegistry = new ToolRegistry();
  await toolRegistry.initialize('calculator', mcpClient);
  await toolRegistry.initialize('email', mcpClient);

  console.log(`\n✓ Discovered MCP Tools:`);
  toolRegistry.getGeminiTools().forEach(t => {
    t.functionDeclarations?.forEach(f => {
      if (f.name) {
        console.log(`  - ${f.name} (original MCP: ${toolRegistry.getToolInfo(f.name)?.name} on ${toolRegistry.getToolInfo(f.name)?.serverId})`);
      }
    });
  });

  const geminiClient = new GeminiClient();
  const agent = new AgentLoop(geminiClient, mcpClient, toolRegistry);
  console.log("\n✓ Gemini initialized\n");

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const runTest = async (testName: string, prompt: string, history: Content[] = []) => {
    console.log(`\n==================================================`);
    console.log(`RUNNING: ${testName}`);
    console.log(`==================================================`);
    console.log(`User:\n${prompt}\n`);
    
    try {
      const finalHistory = await agent.run(prompt, history);
      const lastMessage = finalHistory[finalHistory.length - 1];
      const finalResponse = lastMessage.parts?.map(p => p.text).join('') || '';
      console.log(`\nFinal response:\n${finalResponse}\n`);
      return finalHistory;
    } catch (e: any) {
      console.error(`\nTest failed with error: ${e.message}\n`);
      return history;
    }
  };

  try {
    // TEST 1 — BASIC TOOL USE
    await runTest("TEST 1 — BASIC TOOL USE", "Calculate 25 * 4");

    // TEST 2 — PARENTHESES
    await delay(15000);
    await runTest("TEST 2 — PARENTHESES", "Calculate (2 + 3) * 4");

    // TEST 3 — OPERATOR PRECEDENCE
    await delay(15000);
    await runTest("TEST 3 — OPERATOR PRECEDENCE", "Calculate 2 + 3 * 4");

    // TEST 4 — NO TOOL REQUIRED
    await delay(15000);
    await runTest("TEST 4 — NO TOOL REQUIRED", "Hello, how are you?");

    // TEST 5 — TOOL ERROR
    await delay(15000);
    const historyAfterError = await runTest("TEST 5 — TOOL ERROR", "Calculate 10 / 0");

    // TEST 6 — RECOVERY AFTER ERROR
    await delay(15000);
    await runTest("TEST 6 — RECOVERY AFTER ERROR", "Calculate 10 + 20", historyAfterError);

    // TEST 7 — FOLLOW-UP CONTEXT
    console.log("\n--- TEST 7 — FOLLOW-UP CONTEXT ---");
    await delay(15000);
    const historyT7_1 = await runTest("TEST 7 (Part 1)", "Calculate 15 * 3");
    
    await delay(15000);
    await runTest("TEST 7 (Part 2)", "What was the result of that calculation?", historyT7_1);

    // TEST 8 — NATURAL LANGUAGE
    await delay(15000);
    await runTest("TEST 8 — NATURAL LANGUAGE", "What is 45 multiplied by 9?");

    // TEST 9 — NON-CALCULATOR QUESTION
    await delay(15000);
    const historyT9 = await runTest("TEST 9 (Part 1)", "What is the capital of France?");
    await delay(15000);
    await runTest("TEST 9 (Part 2)", "Can you explain what MCP is?", historyT9);

    // TEST 10 — MULTIPLE TOOL CALLS
    await delay(15000);
    await runTest("TEST 10 — MULTIPLE TOOL CALLS", "Calculate 25 * 4, then calculate 100 / 5.");

    // TEST 11 — UNKNOWN TOOL SECURITY TEST
    console.log("\n--- TEST 11 — UNKNOWN TOOL SECURITY TEST ---");
    console.log("Simulating an unknown tool call 'delete_everything' from Gemini...");
    const fakeToolName = "delete_everything";
    const mcpName = toolRegistry.getOriginalToolName(fakeToolName);
    if (!mcpName) {
      console.log(`[Agent] Invalid tool requested: ${fakeToolName}`);
      console.log("✅ PASS: Security test passed. Unknown tool correctly rejected.");
    } else {
      console.error("❌ FAIL: Security test failed. Unknown tool was accepted!");
    }

    // TEST 12 - EMAIL SERVER TEST
    await delay(15000);
    await runTest("TEST 12 - EMAIL SERVER", "Can you send an email to user@example.com with the subject 'Hello MCP' and body 'This is a test from the Agent Loop'?");
    
  } finally {
    await mcpClient.closeAll();
  }
}

main().catch(e => {
  console.error("Fatal Error in tests:", e);
});

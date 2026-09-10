import { McpClientManager } from './mcp-client.js';
import { config } from './config.js';

async function main() {
  const client = new McpClientManager();

  try {
    await client.connect('calculator', config.calculatorServerPath);

    const tools = await client.listTools('calculator');
    console.log('\nAvailable tools:');
    tools.tools.forEach((t: any) => {
      console.log(`\n${t.name}`);
      console.log(`\nDescription:\n${t.description}`);
      console.log(`\nInput schema:\n${JSON.stringify(t.inputSchema, null, 2)}`);
    });

    const callAndPrint = async (expr: string) => {
      const res = await client.callTool('calculator', 'calculator.evaluate', { expression: expr });
      if (res.isError) {
        console.log(`Result: Tool Error - ${res.content[0].text}`);
      } else {
        console.log(`Result: ${res.content[0].text}`);
      }
    };

    await callAndPrint("25 * 4");
    await callAndPrint("(2 + 3) * 4");
    await callAndPrint("10 / 0");
    await callAndPrint("10 + 20");

  } catch (error) {
    console.error("Fatal Error:", error);
  } finally {
    await client.closeAll();
  }
}

main();

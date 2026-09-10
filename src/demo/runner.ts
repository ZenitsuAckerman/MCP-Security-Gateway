import { Sentinel } from '../index';
import { attackCorpus, AttackCase } from './attacks';
import * as fs from 'fs';
import * as path from 'path';

export function runDemo() {
  console.log('============================================================');
  console.log('MCP SENTINEL');
  console.log('CONTENT SECURITY DEMO');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;
  const decisions: Record<string, number> = { ALLOW: 0, SANITIZE: 0, BLOCK: 0, QUARANTINE: 0, FLAG: 0 };
  let falsePositives = 0;

  for (let i = 0; i < attackCorpus.length; i++) {
    const attack = attackCorpus[i];
    const indexStr = (i + 1).toString().padStart(2, '0');
    console.log(`[${indexStr}] ${attack.name}`);
    console.log(`Source: ${attack.server || 'unknown'}.${attack.tool || 'unknown'}`);
    
    let emittedEvent: any = null;
    const unsub = Sentinel.onEvent((e) => { emittedEvent = e; });

    let decisionStr = '';
    let resDecision = '';
    let isSuccess = true;
    let failureReason = '';
    
    try {
      if (attack.source === 'tool_description') {
        const res = Sentinel.inspectDescription({
          server: attack.server,
          tool: attack.tool,
          description: attack.input,
          knownTools: attack.knownTools
        });
        resDecision = res.decision;
        
        decisions[res.decision]++;
        decisionStr = `Decision: ${res.decision} Severity: ${res.severity}`;
        
        if (res.decision !== attack.expectedDecision) {
          isSuccess = false;
          failureReason = `Expected ${attack.expectedDecision}, got ${res.decision}`;
        }
        if (attack.expectedSeverity && res.severity !== attack.expectedSeverity) {
          isSuccess = false;
          failureReason = `Expected severity ${attack.expectedSeverity}, got ${res.severity}`;
        }

      } else {
        const res = Sentinel.inspectOutput({
          server: attack.server,
          tool: attack.tool,
          content: attack.input,
          knownTools: attack.knownTools
        });
        resDecision = res.decision;
        
        decisions[res.decision]++;
        decisionStr = `Decision: ${res.decision} Severity: ${res.severity}`;
        
        if (res.decision === 'SANITIZE') {
          decisionStr += ` Agent receives: ${res.content.replace(/\n/g, ' ')}`;
        }

        if (res.decision !== attack.expectedDecision) {
          isSuccess = false;
          failureReason = `Expected ${attack.expectedDecision}, got ${res.decision}`;
        }
        if (attack.expectedSeverity && res.severity !== attack.expectedSeverity) {
          isSuccess = false;
          failureReason = `Expected severity ${attack.expectedSeverity}, got ${res.severity}`;
        }
        if (attack.expectedSanitizedContains && !res.content.includes(attack.expectedSanitizedContains)) {
          isSuccess = false;
          failureReason = `Expected output to contain: "${attack.expectedSanitizedContains}"`;
        }
        if (attack.expectedSanitizedMissing && res.content.includes(attack.expectedSanitizedMissing)) {
          isSuccess = false;
          failureReason = `Expected output to NOT contain: "${attack.expectedSanitizedMissing}"`;
        }
      }

      if (attack.expectedEvent) {
        if (!emittedEvent || emittedEvent.event !== attack.expectedEvent) {
          isSuccess = false;
          failureReason = `Expected event ${attack.expectedEvent}, got ${emittedEvent?.event}`;
        } else {
          decisionStr += ` Event: ${emittedEvent.event}`;
        }
      } else if (emittedEvent && attack.expectedDecision === 'ALLOW') {
        // Safe things shouldn't emit events usually
        isSuccess = false;
        failureReason = `Unexpected event emitted: ${emittedEvent.event}`;
      }

      // Check false positives
      if (!isSuccess && attack.expectedDecision === 'ALLOW') {
        falsePositives++;
      }

    } catch (err: any) {
      isSuccess = false;
      failureReason = `Error thrown during inspection: ${err.message}`;
    } finally {
      unsub();
    }

    if (isSuccess) {
      passed++;
      const emoji = attack.expectedDecision === 'ALLOW' ? '✓ SAFE' : 
                    attack.expectedDecision === 'SANITIZE' ? '🛡 OUTPUT SANITIZED' : 
                    '🚨 TOOL POISONING DETECTED';
      console.log(`EXPECTED: ${attack.expectedDecision}`);
      console.log(`ACTUAL: ${resDecision}`);
      console.log(`RESULT: PASS — ${emoji}\n`);
    } else {
      failed++;
      console.log(`EXPECTED: ${attack.expectedDecision}`);
      console.log(`ACTUAL: ${resDecision || 'ERROR'}`);
      console.log(`RESULT: FAIL — ${failureReason}\n`);
    }
  }

  console.log('============================================================');
  console.log('SUMMARY');
  console.log(`Total Cases: ${attackCorpus.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Safe/Allowed: ${decisions.ALLOW}`);
  console.log(`Flagged: ${decisions.FLAG}`);
  console.log(`Sanitized: ${decisions.SANITIZE}`);
  console.log(`Blocked: ${decisions.BLOCK}`);
  console.log(`Quarantined: ${decisions.QUARANTINE}`);
  console.log(`False Positives: ${falsePositives}`);

  // Write machine-readable report
  const report = {
    timestamp: new Date().toISOString(),
    totalCases: attackCorpus.length,
    passed,
    failed,
    decisions,
    falsePositives
  };

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'security-demo-report.json'), JSON.stringify(report, null, 2));

  if (failed > 0) {
    console.error('\nDEMO FAILED: One or more mandatory assertions failed.');
    process.exit(1);
  } else {
    console.log('\nDEMO COMPLETED SUCCESSFULLY.');
    process.exit(0);
  }
}

runDemo();

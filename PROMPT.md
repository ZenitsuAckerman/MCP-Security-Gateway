# MCP Sentinel — Person 4

## Phase-by-Phase Anti Gravity Prompts

### PHASE 0 — Repository Audit, Ownership Boundary & Integration Contract

```text
You are working as PERSON 4 on the MCP Sentinel project.

My ownership:
1. Event/observability layer
2. Dashboard
3. Event-to-dashboard integration
4. Final integration testing across the whole Sentinel flow

Do NOT implement or rewrite Person 1's MCP client/server foundation.
Do NOT implement Person 2's manifest hashing/pinning/reapproval logic.
Do NOT implement Person 3's detector/sanitizer security logic.
You may create only the adapters/hooks/interfaces required to consume their outputs.

REFERENCE ARCHITECTURE:
Client
  ↓
Sentinel Proxy
  ├── Integrity
  ├── Content Detector
  ├── Sanitizer
  └── Event Bus
        ↓
     Dashboard

REFERENCE FLOW:
tools/list → security decisions → events → dashboard
tools/call → security/runtime decisions → events → dashboard
approval → approved event → dashboard update

FIRST: inspect the entire existing repository before changing anything.

Determine:
- current language/runtime
- package manager
- existing directory structure
- current Sentinel entrypoint
- current HTTP server, if any
- current WebSocket/event implementation, if any
- existing dashboard files, if any
- existing event producers
- current event schema
- current API routes
- how teammates' branches/work are represented in the current working tree

Do NOT rewrite the project structure just to match the documentation.
Preserve working code.

IMPORTANT EVENT SCHEMA ISSUE:
The project documents currently contain two discriminator names:
- some interfaces use `event`
- the E2E plan uses `type`

Do NOT blindly rename existing fields.
Create a small normalization/adapter boundary so the dashboard can safely consume either representation while keeping one stable internal event model.
Prefer the schema already used by the active codebase.
Do not break upstream producers.

Create/update a small shared contract for dashboard consumption covering at minimum:

tool_call
tool_result
manifest_pinned
manifest_verified
manifest_mismatch
detector_flagged
output_sanitized
approved

Also support, when produced:
tool_suspended
workflow_blocked

Required semantic fields where available:
- id
- timestamp
- event/type
- server
- tool
- workflowId
- dataId
- details

Do not require every field on every event.

At the end of this phase:
1. Do not build the full dashboard yet.
2. Create only the clean integration contract/adapter needed by the rest of my work.
3. Add mock events/fixtures if they are useful.
4. Run the existing tests.
5. Report:
   - files changed
   - existing event producers discovered
   - schema chosen internally
   - compatibility handling for `event` vs `type`
   - exact integration points future phases should use

Do not proceed into unrelated security logic.
```

---

### PHASE 1 — Event Bus

```text
Continue MCP Sentinel PERSON 4 work.

Now implement the Event Bus / event transport layer.

GOAL:
Every meaningful Sentinel security/runtime decision should be observable by the dashboard without blocking tool execution.

Architecture:

Sentinel
   ↓
Event Emitter
   ├── WebSocket → live dashboard
   └── Audit storage → replay/history

REQUIREMENTS:

1. Reuse the existing project HTTP stack if one exists.
2. Use WebSocket (`ws`) if the project already uses Node/TypeScript and no strong reason exists not to.
3. If there is already an event emitter abstraction, extend it rather than creating a competing system.
4. Event publication must be non-blocking relative to tool execution.
5. A dashboard disconnect must NEVER cause an MCP tool call to fail.
6. Do not introduce authentication.
7. Do not introduce cloud infrastructure.
8. Do not over-engineer this into Kafka/Redis/etc.

Implement a single clear API such as:

emitAuditEvent(event)

The implementation should:
- normalize incoming event objects
- timestamp events if missing
- assign an ID if missing
- broadcast to connected WebSocket clients
- optionally persist events for replay/history

Use SQLite only if it fits the existing project cleanly.
Otherwise use a small in-memory event store first.

Required events:

tool_call
tool_result
manifest_pinned
manifest_verified
manifest_mismatch
detector_flagged
output_sanitized
approved

Optional:
tool_suspended
workflow_blocked

Preserve:
workflowId
dataId

Also retain:
server
tool
details

Create a small test suite proving:
- event is emitted
- WebSocket receives event
- malformed event does not crash Sentinel
- disconnected dashboard does not break Sentinel
- multiple dashboard clients can receive events
- normalization handles the `event`/`type` compatibility issue

Do NOT build visual dashboard features yet.

At the end:
- run tests
- verify the event endpoint/WS endpoint manually
- document the exact endpoint/port/interface for the next phase
- report changed files and integration assumptions
```

---

### PHASE 2 — Dashboard Foundation

```text
Continue MCP Sentinel PERSON 4 work.

Now build the first dashboard version.

GOAL:
Create a simple, reliable, demo-ready browser dashboard that connects to the Sentinel Event Bus.

DO NOT use a heavy frontend architecture unless the existing repository already uses one.
Prefer the simplest working implementation:
HTML + CSS + vanilla JavaScript.

Do NOT spend time on:
- authentication
- cloud deployment
- fancy React architecture
- charts
- animations
- design-system abstraction
- LLM-generated explanations

The dashboard must look like a cybersecurity monitoring console, not a generic admin page.

PAGE STRUCTURE:

1. Header
   - MCP Sentinel
   - connection status
   - number of connected/known tools

2. Server/Tool Status panel

Example:

calculator.evaluate   TRUSTED
email.send            TRUSTED
docgen.create         SUSPENDED

Each row should support:
- server/tool name
- current state
- pinned/known hash if supplied by events
- last verification time
- latest security status

States:
TRUSTED
VERIFIED
FLAGGED
SUSPENDED
MUTATION DETECTED

3. Live Security Feed

Scrolling event feed showing:
timestamp
event
server
tool
human-readable summary

Examples:
tool_call calculator.evaluate
tool_result calculator.evaluate
manifest_mismatch calculator.evaluate
tool_suspended calculator.evaluate
approved calculator.evaluate

4. Main layout must leave room for:
- manifest diff
- security alert
- approval action

Do not fake security results.
The dashboard must be driven by real events from the Event Bus.

However, also create mock-event mode so development can proceed without waiting for teammates.

Implement:
- WebSocket connect
- automatic reconnect
- graceful disconnected state
- event normalization
- event-to-UI mapping
- basic responsive layout

At the end:
- verify dashboard opens in browser
- verify mock events render correctly
- verify real WebSocket events render correctly
- list files changed
- do not modify unrelated Sentinel security code
```

---

### PHASE 3 — Live Security Feed + Tool State Machine

```text
Continue MCP Sentinel PERSON 4 work.

Now make the dashboard actually understand Sentinel security state transitions.

PRIMARY STATE MACHINE:

TRUSTED
   ↓
MUTATION DETECTED
   ↓
SUSPENDED
   ↓
REAPPROVAL
   ↓
TRUSTED

Also support:
TRUSTED → FLAGGED
TRUSTED → VERIFIED
TRUSTED → OUTPUT SANITIZED

IMPORTANT:
The dashboard is only a visualization and interaction layer.
It must NOT independently decide whether a tool is safe.

Security truth comes from Sentinel events.

Implement a frontend state store keyed by:

server + tool

For each tool track:
- current status
- latest hash
- previous hash when known
- last verification
- last event
- latest detector state
- workflowId/dataId when present

Event behavior:

manifest_pinned
→ tool becomes TRUSTED/VERIFIED
→ save pinned hash

manifest_verified
→ update last verification
→ maintain trusted state

manifest_mismatch
→ state becomes MUTATION DETECTED
→ store old/new description if present
→ open diff panel

tool_suspended
→ state becomes SUSPENDED

detector_flagged
→ state becomes FLAGGED
→ show security alert

output_sanitized
→ record sanitized result
→ show sanitization event

approved
→ state returns to TRUSTED
→ close/clear pending approval state

tool_call
→ add normal runtime event

tool_result
→ add normal result event

Make the live feed visually easy to understand:
- normal events are visually calm
- warnings stand out
- blocks/suspensions are highly visible
- approval is clearly visible

Do not hard-code the calculator attack as the only possible tool.
The UI should work for any server/tool pair received in events.

Create tests for the complete state transition sequence:

manifest_pinned
→ manifest_verified
→ manifest_mismatch
→ tool_suspended
→ approved

At the end:
- run tests
- manually verify the state machine
- provide a small screenshot/manual verification checklist
- do not add attack logic yet
```

---

### PHASE 4 — Manifest Diff + Security Alert + Approval Integration

```text
Continue MCP Sentinel PERSON 4 work.

Now implement the most important judge-facing dashboard interaction.

When a manifest mismatch occurs, the dashboard must immediately make the security decision understandable.

MANIFEST DIFF PANEL:

Show:

OLD DEFINITION
----------------
description
relevant schema information when available

NEW DEFINITION
----------------
description
relevant schema information when available

Do not merely display:
"HASH MISMATCH"

Explain visually:
"TOOL DEFINITION CHANGED"

If event details contain capability/security information, show:

Previously approved:
✓ computation

Newly detected:
+ network
+ email
+ external communication

Do not invent capabilities that were not supplied by Sentinel.

APPROVAL FLOW:

Dashboard button:
[ APPROVE ]

On click:
POST /approve

Payload:

{
  "server": "...",
  "tool": "..."
}

Person 2 owns the actual reapproval logic.
Person 4 owns only the HTTP/UI wiring.

The dashboard must:
1. send the request
2. show "Approval requested..."
3. wait for the resulting `approved` event
4. update the UI from the event
5. never assume approval succeeded merely because HTTP returned 200

Also support:
[ DENY ]

If there is no backend deny endpoint, do not invent one.
Make it visually available only if a real backend contract exists.

SECURITY ALERT PANEL:

For detector events, show:

⚠ TOOL POISONING DETECTED

Server:
Tool:

Reason:
<event-provided reason>

For mismatch:

🚨 TOOL MUTATION DETECTED

For sanitization:

✓ OUTPUT SANITIZED

Show:
server
tool
reason
what was removed when supplied

IMPORTANT:
Do not use an LLM to generate dashboard explanations.
Use deterministic templates based on event type/details.

Test:
1. mismatch event opens diff
2. approve request is sent
3. dashboard waits for approved event
4. approved event changes state to TRUSTED
5. detector alert renders
6. output_sanitized renders
7. no fabricated security data appears
```

---

### PHASE 5 — Attack Trigger Integration

```text
Continue MCP Sentinel PERSON 4 work.

Now add the optional dashboard attack-trigger controls described by the MCP Sentinel E2E plan.

The dashboard should be able to trigger the real demo attacks through Sentinel HTTP endpoints.

IMPORTANT:
Do not implement the attack itself inside the dashboard.
The dashboard only calls a backend attack-toggle endpoint.

Target controls:

[ Trigger: Calculator hijack ]
[ Trigger: Doc injection ]

When clicked:
- send HTTP request to Sentinel
- show "attack requested"
- wait for actual security events
- update UI from the event stream

Do NOT fake:
manifest_mismatch
detector_flagged
output_sanitized
tool_suspended

These must come from Sentinel.

Calculator scenario expected flow:

dashboard trigger
    ↓
Sentinel changes/restarts relevant server
    ↓
tools/list or verification detects mutation
    ↓
manifest_mismatch
    ↓
tool_suspended
    ↓
dashboard displays diff
    ↓
user clicks APPROVE
    ↓
POST /approve
    ↓
approved event
    ↓
dashboard shows TRUSTED

DocGen scenario expected flow:

dashboard trigger
    ↓
real poisoned output
    ↓
sanitizer
    ↓
output_sanitized
    ↓
dashboard shows what was removed

Handle attack endpoint failures gracefully.
The UI should never pretend an attack succeeded if the backend failed.

If the backend attack-toggle API is not yet available:
- build the frontend integration behind a clearly defined interface
- provide a mock mode
- do not modify another teammate's server implementation just to make the button work

At the end test both:
1. mock trigger path
2. real trigger path, if backend exists
```

---

### PHASE 6 — Full Integration Owner Pass

```text
You are now acting as PERSON 4 AND INTEGRATION OWNER.

The other teammates' components may now be available.

Do not rewrite their security logic.
Integrate with it.

Run the actual complete system:

Client
  ↓
Sentinel
  ↓
tools/list
  ↓
Integrity
  ↓
Content Detector
  ↓
safe/approved tools
  ↓
tools/call
  ↓
MCP Server
  ↓
Output Sanitizer
  ↓
Client

And simultaneously:

Security decision
  ↓
Event Bus
  ↓
WebSocket
  ↓
Dashboard

INTEGRATION CHECKPOINT 1:
Happy path

Run:
calculator → email → docgen

Verify:
- real client works
- all normal tool calls appear
- tool results appear
- dashboard remains connected
- no security false blocks

INTEGRATION CHECKPOINT 2:
Calculator mutation

Run the real calculator rug-pull scenario.

Verify:
- mutation actually happens
- integrity layer emits event
- dashboard receives event
- diff opens
- tool enters suspended/mutated state
- approve action reaches backend
- approved event returns
- dashboard returns to trusted
- no restart is needed for reapproval if backend supports the documented flow

INTEGRATION CHECKPOINT 3:
Tool poisoning

Verify:
- detector emits detector_flagged
- dashboard shows attack explanation
- event feed contains the event
- no fake frontend decision is involved

INTEGRATION CHECKPOINT 4:
DocGen output poisoning

Verify:
- real poisoned output reaches sanitizer
- output_sanitized event is emitted
- dashboard displays sanitization
- client receives sanitized content

INTEGRATION CHECKPOINT 5:
Event reliability

Verify:
- temporarily disconnect dashboard
- Sentinel/tool execution still works
- reconnect dashboard
- dashboard recovers gracefully
- persisted/replayed events work if storage is implemented

Do not optimize cosmetics before all five checkpoints pass.

At the end produce:
- exact working command(s)
- exact ports/endpoints
- integration dependencies
- remaining bugs
- tests passed/failed
- files changed
```

---

### PHASE 7 — Demo Hardening + Judge-Proof Dashboard

```text
Final PERSON 4 phase.

The core system is now integrated.
Do NOT add new major features.

Optimize only for:
1. reliability
2. clarity
3. demo reproducibility
4. judge understanding

The dashboard must make these three attacks immediately understandable:

ATTACK 1 — TOOL MUTATION / RUG PULL

TRUSTED
  ↓
MUTATION DETECTED
  ↓
SUSPENDED
  ↓
DIFF
  ↓
APPROVE
  ↓
TRUSTED

ATTACK 2 — TOOL POISONING

TOOL DESCRIPTION
  ↓
DETECTOR FLAG
  ↓
BLOCK/FLAG
  ↓
DASHBOARD ALERT

ATTACK 3 — OUTPUT INJECTION

MALICIOUS RESULT
  ↓
SANITIZER
  ↓
[UNTRUSTED INSTRUCTION REMOVED]
  ↓
SAFE RESULT

The dashboard should answer these judge questions visually:

"What happened?"
→ live event feed

"Which tool is affected?"
→ server/tool status

"What changed?"
→ old/new diff

"Why was it blocked?"
→ security alert/reason field

"What did the user approve?"
→ approval state

"Can we see the history?"
→ audit/event history

"Did the system actually block it?"
→ visible suspended/blocked state

Improve only useful UX:
- clear status labels
- readable timestamps
- strong distinction between normal/warning/block states
- concise attack explanations
- avoid clutter
- keep the dashboard usable on a projector

Do NOT:
- add authentication
- add cloud deployment
- add complicated analytics
- add unnecessary charts
- replace deterministic security logic with LLM logic
- implement the future Intent-Flow Integrity layer
- rewrite the proxy

Finally run the entire demo twice from a clean start.

Record:
1. startup command
2. happy-path sequence
3. calculator attack sequence
4. approval sequence
5. docgen attack sequence
6. expected dashboard state after each action

Fix only reproducibility/reliability issues.

Return a final integration report with:
- completed PERSON 4 scope
- files changed
- APIs used
- event schema
- WebSocket endpoint
- approval endpoint
- attack endpoints
- known limitations
- exact demo procedure
```

---

## Operating rule for every phase

At the end of **every Anti Gravity run**, use this small follow-up instruction before moving to the next phase:

```text
STOP.

Do not start the next phase.

Report only:
1. What was implemented
2. Files created/modified
3. Tests run and results
4. Current integration points
5. Any assumptions made
6. Any blockers
7. Exact command to run this phase

Do not modify unrelated teammate-owned code.
```

## Your build order

The sequence is intentionally:

**Phase 0 → Contract**
**Phase 1 → Event Bus**
**Phase 2 → Dashboard shell**
**Phase 3 → Live state/feed**
**Phase 4 → Diff + approval**
**Phase 5 → Attack controls**
**Phase 6 → Full integration**
**Phase 7 → Demo hardening**

That matches your role as observability/integration owner and the team's “build against stable interfaces and mock data first” strategy.

Most importantly, **do not wait for the other three teammates before starting**. Phase 0–4 can be developed against mock events, exactly as the team plan recommends.

The final integration target should be the real `Client → Sentinel → Integrity → Detector → Server → Sanitizer → Client` path with the Event Bus feeding your dashboard, and the E2E plan explicitly treats those real end-to-end attack flows as non-negotiable.

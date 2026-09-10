# MCP Sentinel --- Team Integration Plan

## The key rule

All four people work on the same repository, but they do NOT need to
wait for one another.

Build against stable interfaces and mock data first.

The final architecture is:

``` text
                    MCP CLIENT
                        |
                        v
                +---------------+
                | SENTINEL PROXY|
                +-------+-------+
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
     Calculator       Email        DocGen
```

Inside Sentinel:

``` text
                     SENTINEL
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
     Integrity      Content Guard   Event Bus
          |             |             |
          +-------------+-------------+
                        |
                        v
                    Dashboard
```

------------------------------------------------------------------------

# 1. Where exactly do we connect?

The **Sentinel Proxy is the central integration point**.

Person 1 owns:

``` text
MCP Client + MCP Servers
```

Person 2 plugs into the proxy's handling of:

``` text
tools/list
```

Person 3 plugs into:

``` text
tools/list → descriptions
tools/call → results
```

Person 4 plugs into:

``` text
all security decisions → Event Bus → Dashboard
```

Do NOT connect security logic directly into the individual MCP servers.

------------------------------------------------------------------------

# 2. Suggested repository structure

``` text
mcp-sentinel/
│
├── servers/
│   ├── calculator/
│   ├── email/
│   └── docgen/
│
├── client/
│   └── sentinel-client/
│
├── sentinel/
│   ├── proxy/
│   │   ├── router.*
│   │   └── server_manager.*
│   │
│   ├── integrity/
│   │   ├── canonicalizer.*
│   │   ├── hasher.*
│   │   ├── registry.*
│   │   └── diff.*
│   │
│   ├── security/
│   │   ├── detector.*
│   │   └── sanitizer.*
│   │
│   ├── events/
│   │   └── event_bus.*
│   │
│   └── api/
│       └── approval.*
│
├── dashboard/
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── tests/
│   ├── integrity/
│   ├── security/
│   └── e2e/
│
└── README.md
```

If the existing MCP-Sentinel-Research repository is being extended,
preserve its existing attack-lab structure where practical instead of
rewriting it.

------------------------------------------------------------------------

# 3. The interfaces everyone agrees on

## Tool Manifest

Person 1 obtains this from MCP.

Person 2 consumes it.

Person 3 can inspect its description.

Person 4 receives the resulting events.

Conceptual shape:

``` json
{
  "server": "calculator",
  "tool": "evaluate",
  "name": "evaluate",
  "description": "Evaluate a mathematical expression",
  "inputSchema": {}
}
```

------------------------------------------------------------------------

## Audit Event

Everyone uses the same shape:

``` json
{
  "id": "evt-001",
  "timestamp": "2026-09-10T16:30:00",
  "event": "manifest_mismatch",
  "server": "calculator",
  "tool": "evaluate",
  "workflowId": "wf-001",
  "dataId": null,
  "details": {}
}
```

Not every event needs every field, but keep the top-level structure
consistent.

------------------------------------------------------------------------

# 4. Exact connection flow

## A. `tools/list`

When the client asks Sentinel:

``` text
Client
  |
  | tools/list
  v
Sentinel
  |
  v
MCP Servers
```

Servers return their tools.

Then Sentinel should process each tool:

``` text
raw tool manifest
       |
       +----> Person 2: canonicalize + hash + verify
       |
       +----> Person 3: inspect description
       |
       +----> Person 4: emit events
       |
       v
approved/safe tool list
       |
       v
Client
```

Conceptually:

``` python
tools = upstream_tools_list()

for tool in tools:
    integrity = verify_manifest(tool)
    safety = scan_description(tool.description)

    emit_events(integrity, safety)

    if integrity.suspended:
        block_tool(tool)

    if safety.quarantined:
        sanitize_or_replace_description(tool)

return filtered_tools
```

The exact implementation can differ depending on the MCP SDK.

------------------------------------------------------------------------

# 5. Exact `tools/call` flow

Client:

``` text
Client
  |
  | tools/call calculator.evaluate
  v
Sentinel
  |
  +--> record tool_call
  |
  +--> check tool is trusted
  |
  v
MCP Server
  |
  v
Tool result
  |
  +--> Person 3: sanitize output
  |
  +--> Person 4: emit events
  |
  v
Client
```

Conceptually:

``` python
emit(tool_call)

if is_suspended(server, tool):
    raise ToolSuspended()

result = call_upstream(server, tool, args)

safe_result = sanitize_output(result)

emit(tool_result)

return safe_result
```

------------------------------------------------------------------------

# 6. Approval flow

Dashboard:

``` text
User clicks APPROVE
        |
        v
POST /approve
        |
        v
Sentinel
        |
        v
Person 2's approve()
        |
        +--> canonicalize
        +--> hash
        +--> save new manifest
        +--> save new hash
        +--> unsuspend
        |
        v
emit approved
        |
        v
Dashboard updates TRUSTED
```

No restart.

------------------------------------------------------------------------

# 7. How to work simultaneously

## Before coding --- 20 to 30 minutes together

Agree on:

1.  language/runtime
2.  repository structure
3.  manifest shape
4.  event shape
5.  Sentinel proxy entry points
6.  how servers are started
7.  how attacks are toggled

Then create the skeleton and commit it.

------------------------------------------------------------------------

## After that

### Person 1

Works with real MCP SDK:

``` text
servers/
client/
```

### Person 2

Uses mock JSON:

``` text
tests/fixtures/manifest_v1.json
tests/fixtures/manifest_v2.json
```

### Person 3

Uses mock strings/results:

``` text
tests/fixtures/poisoned_description.txt
tests/fixtures/poisoned_output.txt
```

### Person 4

Uses mock events:

``` text
manifest_pinned
manifest_mismatch
detector_flagged
approved
```

Nobody waits.

------------------------------------------------------------------------

# 8. First integration checkpoint

As soon as Person 1 has:

``` text
Client → Sentinel → Calculator
```

stop and integrate.

Do not wait for all three servers.

Connect Person 2 first:

``` text
Client
 ↓
Sentinel
 ↓
tools/list
 ↓
Integrity
 ↓
Calculator
```

Then Person 3:

``` text
tools/list
 ↓
Integrity
 ↓
Detector
 ↓
Client
```

Then Person 4:

``` text
Security decisions
 ↓
Event Bus
 ↓
Dashboard
```

------------------------------------------------------------------------

# 9. Git workflow

Use one shared GitHub repository.

Recommended branches:

``` text
main
│
├── person1/mcp-foundation
├── person2/manifest-integrity
├── person3/content-security
└── person4/dashboard-events
```

Commit small working pieces.

Example:

``` text
person2:
feat: add canonical manifest hashing

person3:
feat: add cross-tool poisoning detector

person4:
feat: add manifest mismatch event UI
```

Merge frequently.

Do NOT leave integration until the final hour.

------------------------------------------------------------------------

# 10. Integration checkpoints

## Checkpoint 1 --- Foundation

``` text
Client → Sentinel → Calculator
```

Must work.

## Checkpoint 2 --- Integrity

``` text
Calculator
   ↓
modified description
   ↓
SHA mismatch
   ↓
tool suspended
```

Must work.

## Checkpoint 3 --- Reapproval

``` text
Suspended
   ↓
Dashboard APPROVE
   ↓
new baseline
   ↓
Trusted
```

Must work without restart.

## Checkpoint 4 --- Description poisoning

``` text
malicious calculator
   ↓
detector
   ↓
flag/block
   ↓
dashboard
```

## Checkpoint 5 --- Output poisoning

``` text
malicious DocGen
   ↓
poisoned result
   ↓
sanitizer
   ↓
safe result
```

## Checkpoint 6 --- Full demo

``` text
Client
 ↓
Sentinel
 ├── Integrity
 ├── Detector
 ├── Sanitizer
 └── Events
 ↓
Servers

            ↘ Dashboard
```

------------------------------------------------------------------------

# 11. The novelty layer comes AFTER Checkpoint 6

Do not let novelty destabilize the MVP.

Once everything above works, add:

``` text
workflowId
    ↓
Intent
    ↓
Tool actions
    ↓
Data provenance
    ↓
Destination
    ↓
Workflow policy
```

The existing event system becomes the input to this layer.

That means the novelty is an extension:

``` text
              EXISTING MVP
                   |
      +------------+------------+
      |            |            |
  Integrity    Content       Events
                              |
                              v
                       +-------------+
                       | Intent-Flow |
                       | Integrity   |
                       +------+------+
                              |
                    +---------+---------+
                    |                   |
               Data Flow          Destination
                    |                   |
                    +---------+---------+
                              |
                         Policy Decision
```

## Golden rule

**MCP servers are dumb.**

**MCP client is dumb.**

**Sentinel is where security lives.**

That separation is what allows all four of you to work independently now
and lets us add the novelty later without rebuilding the whole project.

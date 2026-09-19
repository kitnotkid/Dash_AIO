# Universal Machine Data Platform — Project Guide

## Repository

Primary repository: kitnotkid/Dash_AIO
Browser editor: vscode.dev/github/kitnotkid/Dash_AIO

Note: this is a NEW repository / new codebase. The existing PLC collector, dashboard,
and any linked template/zip in earlier drafts of this guide are DESIGN REFERENCES only
— proven patterns to learn from, not code to extend or a schema to be bound by.

---

## 1. Objective

Build a universal machine data acquisition and analytics platform that works across
manufacturing machines and PLCs without rewriting the full application per customer.

Product path:

    PLC export → Tag configuration → machine_config.json → PLC collection → SQLite events → Analytics dashboard

Core principle:

    Configure once → collect meaningful machine data → preserve event history → visualize and analyze.

Separate concerns:
1. Machine configuration (what to read)
2. PLC data acquisition (live reading)
3. Historical data storage (what happened)
4. Visualization and analytics (calculated from history, not baked into storage)

---

## 2. Reference Systems (not to be extended)

These are prior work to learn from — not a codebase this project builds on top of:

| Reference | What it demonstrates | Use it for |
|---|---|---|
| Existing .NET PLC poller (libplctag) | PLC comms, polling, connection handling, simulated polling | Design reference for the new collector |
| Existing SQLite/EF Core history DB | State/event storage shape, run-session + self-join analysis pattern | Reference for event-detection logic — see §9 |
| Existing HAE dashboard (multiple versions) | Visual language, analytics presentation | Reference for the new dashboard's look and analytics scope, not its code |

None of these are extended, patched, or generalized in place. The new repo reimplements
the proven concepts fresh.

---

## 3. Product Architecture — Three Components, Built in Order

    1. Tag Configurator      PLC export → machine_config.json
    2. PLC Collector         machine_config.json → live PLC readings → SQLite event history
    3. Analytics Dashboard   SQLite event history → production, downtime, fault, OEE analysis

| Product | Responsibility | Starting point |
|---|---|---|
| Tag Configurator | Maps customer PLC tags to universal machine signals, exports config JSON | New build |
| PLC Collector | Reads config, polls PLCs, stores meaningful machine events | New build, informed by existing prototype's proven patterns |
| Analytics Dashboard | Reads historical DB, presents production analytics | New build, informed by existing HAE dashboard |

Target end-to-end architecture:

    PLC Tag File (L5K/CSV) → Tag Configurator → machine_config.json
        → PLC Collector → Machine Database (state/fault/production events)
        → Analytics Dashboard (OEE, downtime, faults, micro-stops)

---

## 4. Component 1 — Tag Configurator

### Delivery form
Browser-based app (HTML/CSS/TypeScript). No Windows desktop app for MVP.

    Customer selects L5K/CSV from their computer
    → browser parses the file locally
    → customer searches and maps tags
    → browser saves the draft locally (persistent browser storage, not cache)
    → browser exports machine_config.json

PLC export is never uploaded to a server for the MVP — supports offline use and keeps
customer PLC information on their device. This matters specifically for OT (Operational
Technology — the industrial control/network side, as opposed to IT) environments, where
customers are typically wary of anything reaching outside their factory network.

### MVP scope
1. Import Rockwell `.L5K` and Rockwell/generic tag CSV.
   — Note: Rockwell CSV format varies by export tool (RSLogix vs Studio 5000, different
   column sets). Collect real sample files from each before finalizing the parser.
2. Extract available tags and their data types.
3. Fast search and filtering.
4. Customer manually assigns tags to universal machine signals.
5. Validate required mappings and data types.
6. Generate and download machine_config.json.
7. Save/restore configuration via persistent browser storage.

The customer makes the final mapping choice. AI may later suggest tags, but never decides.

### Data type integrity (mapping UI)

| Column | Behavior |
|---|---|
| Tag | From parsed L5K/CSV |
| Suggested Type | Auto-filled from the source file's declared type (BOOL/DINT/REAL) |
| Assigned Type | Customer's choice — defaults to Suggested, editable, flagged if it diverges |

This exists specifically to prevent a class of bug already seen once (a REAL tag manually
mapped as DINT, corrupting downstream values). Auto-populating removes the guesswork;
flagging divergence keeps the customer in control without hiding a mistake.

### Initial universal signals

    running_state, stop_state, fault_state, cycle_complete,
    production_count, good_count, reject_count, auto_mode

Exact set will evolve as the collector and dashboard take shape — not fixed to what an
old collector required, since there is no old collector being extended.

### Configuration contract

machine_config.json describes what data exists and where to retrieve it. It must not
contain OEE calculations — that's the dashboard's job, computed from stored events.

```json
{
  "schema_version": "1.0",
  "machine": {
    "name": "Machine_001",
    "plc": { "vendor": "rockwell", "ip": "192.168.1.10" }
  },
  "signals": {
    "running_state": { "tag": "St_0_Master_Ctrl.MachineRun", "data_type": "BOOL" },
    "production_count": { "tag": "St_0_Master_Ctrl.CNT_PartOutProcess", "data_type": "DINT" }
  }
}
```

Schema is not finalized and is not bound to any existing collector's requirements —
it's designed for the new collector being built, informed by (not constrained by) the
reference system's schema shape.

### TypeScript's role (scoped to Configurator only)
TypeScript catches mistakes while parsing PLC files and generating machine_config.json.
Used for: L5K/CSV parsing, tag search/filtering, mapping validation, JSON export,
automated parser tests. Collector stays C#. Dashboard stays browser JS. No Python in
this stack.

```ts
type PlcTag = {
  name: string;
  dataType: "BOOL" | "DINT" | "REAL";
};
```

---

## 5. Component 2 — PLC Collector

New C#/.NET build using libplctag, informed by the reference poller's proven patterns
(connection handling, polling cadence, simulated polling) — not an extension of it.

Target flow:

    machine_config.json → collector loads config → determine PLC vendor/protocol
    → create configured PLC tags → connect → read tags → timestamp
    → detect meaningful state changes → store events

Design principle — configuration-driven, no hardcoded tag names:

    Avoid:    if tag == "St_0_Master_Ctrl.MachineRun"
    Instead:  running_state.tag   (comes from JSON)

Rockwell Ethernet/IP is the first supported PLC communication path. Other vendors only
after this path is proven end-to-end (see §11).

---

## 6. Event Detection — Write-Time, Not Query-Time

This is the key behavioral shift from the reference system, and worth being explicit
about:

| | Reference system (today) | New collector (target) |
|---|---|---|
| Where change is detected | SQL self-join, at query/analysis time | In the collector's polling loop, at write time |
| What's stored | Every poll / frequent samples | Only rows where state actually changed |
| DB growth | Scales with poll rate | Scales with actual machine activity |
| Analytics dependency | Re-runs the self-join every query | Reads sessions directly — already rows |

The comparison logic itself (how to recognize a real state change) is already proven —
it's the self-join pattern used in the existing dashboard's run-session analysis. This
step relocates that logic into the collector so it runs once, on write, instead of
every time someone queries.

MVP target: state changes lasting ~1 second or longer are the reliable-capture bar.
Do not poll aggressively just to chase sub-second events — that adds PLC/network load
without a demonstrated customer need. Sub-second capture (PLC-side latches/counters,
edge detection, batch reads) is a later optimization, only if proven necessary.

Important distinction: a raw tag flicker (sensor ON→OFF→ON in 300ms) is not automatically
a real machine stop. Whether a signal represents a genuine downtime/fault event depends
on how the customer's PLC logic defines it — the collector should not assume every
transient signal is meaningful.

---

## 7. Database — Raw Events, Not Calculated Analytics

The database is the historical record of what actually happened. It stays conceptually
separate from the JSON config:

    JSON:     "What should I read?"
    Database: "What did the machine actually do?"

Categories: state_events, fault_events, production_events, tag_samples, system_events.
SQLite is appropriate for the initial local collector.

Principle — capture first, calculate later:

    PLC → raw observation/event → database → analytics (evolves independently)

Avoid collapsing straight to OEE and discarding the raw events — you lose the ability
to later ask "why was availability low," "which faults caused the most downtime,"
"how many stops were under 5s," etc.

---

## 8. Component 3 — Analytics Dashboard

New build, using the existing HAE dashboard(s) as a visual/analytics reference only —
not as a codebase to generalize in place. (Multiple existing dashboard versions exist;
none of them is "the" system to extend — they're all just reference material.)

Should eventually display: production, running time, stop time, fault time, stop count/
duration, micro-stops, fault frequency, cycle time, availability, performance, quality,
OEE — computed from stored events, without needing to know the original PLC tag names.

---

## 9. Visual Direction (Configurator + Dashboard)

Shared light, calm production-monitor visual system:

- Light blue-gray page background, white content surfaces
- Clear blue as primary brand/action color
- Dark navy text, muted slate secondary text
- Soft, low-contrast borders, restrained shadows
- Rounded corners: ~10px controls, ~16px panels/cards
- Green/amber/red reserved for meaningful machine statuses only
- Clean sans-serif UI type; monospace only for tags, IPs, timestamps

Configurator screen flow: Import → review searchable tags → map signals → validate →
export JSON. No invented production figures, OEE, or machine states in the configurator
— that's the dashboard's job once real data exists.

---

## 10. Technology Decisions

| Product | Technology | Reason |
|---|---|---|
| Tag Configurator | Static browser app: HTML/CSS/TypeScript | Local file parsing, browser storage, JSON export, offline/internal deploy |
| PLC Collector | C#/.NET + libplctag | Proven PLC comms pattern, polling, SQLite, API, simulation |
| Dashboard | Browser app consuming collector DB/API | Keeps analytics separate from PLC comms, reusable across customers |

CSS styles; it's not a substitute for C# or JS. Python is not required for this stack.

---

## 11. Build Sequence

**Phase 0 — Understand reference systems**
- Review existing poller and dashboard(s) as reference: polling approach, state-detection
  logic (the self-join pattern), DB shape.
- Pick which existing dashboard version (if any) best represents the target visual/
  analytics baseline — treat it as reference, not literal code to generalize.
- Treat all of it as informative, not constraining — schema/architecture in this guide
  can change once you're actually building.

**Phase 1 — Build the Tag Configurator**
    L5K/CSV → tag list → manual mapping (with type suggestion) → validation → machine_config.json
Success: customer selects file locally; tag list searchable/legible; required mappings
can't export incomplete; valid JSON downloads and restores locally.

**Phase 2 — Define the JSON contract**
Finalize signal list and schema based on what the new collector actually needs — not
retrofitted to an old collector's requirements.

**Phase 3 — Build the collector**
Load config → create PLC tags from it → use standard signal names → connect → read →
detect state changes at write time (§6) → store events → handle reconnects → log errors.

**Phase 4 — Prove the collector + data model**
Test full path: configured PLC → collector → event detection → SQLite. Verify RUN/STOP/
FAULT transitions, production counts, state duration, reconnect behavior, duplicate-
event prevention — against real or simulated machine behavior, not just theory.

**Phase 5 — Build/connect the dashboard**
Connect validated SQLite data to the new dashboard. Verify production, state duration,
faults, reconnection, duplicate-event prevention.

**Phase 6 — Expand**
Only after the Rockwell path is proven end-to-end: additional PLC vendors, advanced
analytics, AI-assisted mapping, cloud hosting, SaaS features.

---

## 12. Current Priority

    NOW:  Tag Configurator browser MVP
    NEXT: machine_config.json schema finalization + new collector build
    THEN: event history validation + new dashboard build

First complete vertical slice:

    Rockwell L5K/CSV → Tag Configurator → machine_config.json
    → New PLC Collector → New SQLite DB → New Dashboard

---

## 13. Deployment Principles

- Private GitHub repository.
- GitHub Actions to build/test the C# collector.
- Collector runs on a factory PC/internal server that can reach the PLC network.
- Production collector deployed as a Windows Service, not a terminal left open.
- GitHub stores source/build releases — it does not poll factory PLCs directly.

---

## 14. Development Rules

**Reference before reinventing.** Existing systems are reference material for proven
patterns (event/session detection, polling cadence, schema shape) — not code to extend.
Check them before designing a new piece, then build fresh in the new repo.

**Validate against reality.** This targets real industrial machines. Use actual machine
behavior — not just theoretical architecture — to determine polling, event-duration,
DB, and dashboard requirements.

**Multi-vendor stays isolated.** Vendor-specific logic (file importers, PLC comm
drivers) stays isolated at the edges. Universal config and analytics layers stay
vendor-independent. No new-vendor work before the Rockwell path is proven.

**No git commit, no git push.** Claude Code only provide code snippet in chat, do not draft PR create.
Never run `git commit` or `git push` in this repo unless the user explicitly asks
in that exact session. Report what was changed/added/needs updating — the user
commits and pushes themselves.

---

## 15. Product Philosophy — What This Is Not

Not initially: a complete MES, an AI PLC programmer, automatic PLC code modification,
an all-vendor PLC engineering suite, fully automatic tag selection, or a high-frequency
PLC data historian.

Focused goal:

    Turn an existing PLC machine into a standardized source of production data
    with minimal customer engineering work.

Favor reliable, useful event capture with low machine impact over capturing every
possible PLC transition.

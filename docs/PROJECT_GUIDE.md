# Universal Machine Data Platform — Updated Project Guide

## Project Repository

Primary repository: [kitnotkid/Dash_AIO](https://github.com/kitnotkid/Dash_AIO)  
Browser editor: [vscode.dev/github/kitnotkid/Dash_AIO](https://vscode.dev/github/kitnotkid/Dash_AIO)

## 1. Objective

Build a universal machine data acquisition and analytics platform that works across manufacturing machines and PLCs without rewriting the full application for each customer.

The product path is:

```text
PLC export → Tag configuration → machine_config.json → PLC collection → SQLite events → Analytics dashboard
```

The core principle remains:

> Configure once → collect meaningful machine data → preserve event history → visualize and analyse.

## 2. Product Architecture

There are three connected products. They must be built and proven in this order.

```text
1. Tag Configurator
   PLC export → machine_config.json
          ↓
2. PLC Collector
   machine_config.json → live PLC readings → SQLite event history
          ↓
3. Analytics Dashboard
   SQLite event history → production, downtime, fault and OEE analysis
```

| Product | Responsibility | Starting point |
| --- | --- | --- |
| Tag Configurator | Maps customer PLC tags to universal machine signals and exports configuration JSON. | Build from scratch. |
| PLC Collector | Reads the configuration, polls PLCs, and stores meaningful machine events. | New build in C#/.NET + libplctag, using the existing prototype as a design reference. |
| Analytics Dashboard | Reads the historical database and presents production analytics. | New build, using HAE_DB_Dashboard as a visual/analytics reference. |

## 3. Immediate Product: Tag Configurator

The first product is the **Tag Configurator**. It is not the PLC collector and it is not a dashboard rewrite.

### Delivery form

Build it as a browser-based application. A Windows desktop application is not required for the MVP.

The app should work locally in the browser:

```text
Customer selects L5K / CSV from their computer
→ browser parses the file locally
→ customer searches and maps tags
→ browser saves the draft locally
→ browser exports machine_config.json
```

The PLC export should not need to be uploaded to a server for the MVP. This supports offline use and keeps customer PLC information on their device.

### MVP scope

1. Import Rockwell `.L5K` and generic/Rockwell tag CSV files.
2. Extract available tags and their data types.
3. Provide fast search and filtering.
4. Let the customer manually assign tags to universal machine signals.
5. Validate required mappings and data types.
6. Generate and download `machine_config.json`.
7. Save and restore a configuration through persistent browser storage.

AI may later suggest possible tags, but the customer makes the final mapping choice.

### Initial universal signals

```text
running_state
stop_state
fault_state
cycle_complete
production_count
good_count
reject_count
auto_mode
```

The exact schema is not finalized. It should be designed for the new collector being built, informed by (not bound to) the existing prototype's schema.

### Configuration contract

`machine_config.json` describes what data exists and where the collector can retrieve it. It must not contain OEE calculations.

```json
{
  "schema_version": "1.0",
  "machine": {
    "name": "Machine_001",
    "plc": {
      "vendor": "rockwell",
      "ip": "192.168.1.10"
    }
  },
  "signals": {
    "running_state": {
      "tag": "St_0_Master_Ctrl.MachineRun",
      "data_type": "BOOL"
    },
    "production_count": {
      "tag": "St_0_Master_Ctrl.CNT_PartOutProcess",
      "data_type": "DINT"
    }
  }
}
```

## 4. Approved Visual Direction

The Tag Configurator and future dashboard should share a light, calm production-monitor visual system. This borrows the strongest qualities of the existing HAE dashboard and the HAE_DB_Dashboard browser app without making either product imitate the other.

### Theme

* Light blue-gray page background with white content surfaces.
* Clear blue as the primary brand/action color.
* Dark navy text with muted slate secondary text.
* Soft, low-contrast borders and restrained shadows.
* Rounded corners: approximately 10px for controls and 16px for panels/cards.
* Green, amber, and red reserved for meaningful machine statuses only.
* Clean sans-serif UI type with monospace only for tags, IP addresses, and timestamps.

### Configurator UI direction

The first screen should focus on the task at hand:

```text
Import PLC file
→ review searchable tags
→ map standard signals
→ validate
→ export JSON
```

Avoid displaying invented production figures, OEE, or machine states in the configurator. Those belong to the analytics dashboard after real data exists.

## 5. Technology Decisions

| Product | Recommended technology | Reason |
| --- | --- | --- |
| Tag Configurator | Static browser app: HTML, CSS, TypeScript/JavaScript | Local file parsing, browser storage, JSON export, easy offline/internal deployment. |
| PLC Collector | Existing C# / .NET application with libplctag | Reuses existing PLC communication, polling, SQLite, API, and simulation work. |
| Dashboard | Browser app consuming the collector database/API | Keeps analytics separate from PLC communication and reusable across customers. |

CSS is used for visual styling. It is not an alternative to C# or JavaScript. Python is not required for the first product or the existing collector architecture.

## 6. Build Sequence

### Phase 0 — Understand the reusable systems

Before significant changes:

* Inspect HAE_DB_Dashboard's input, SQLite assumptions, and analytics calculations.
* Review the existing C# collector and HAE dashboard as design references — polling approach, state-detection logic, DB shape.
* Treat these as informative, not constraints: the new repo is free to change schema, structure, or approach where it improves the design.

### Phase 1 — Build the Tag Configurator

Deliver a browser app that completes:

```text
L5K / CSV → tag list → manual mapping → validation → machine_config.json
```

Success criteria:

* A customer can select an export file locally.
* The tag list is searchable and legible.
* Required mappings cannot be exported incomplete.
* A valid JSON configuration downloads and restores locally.

### Phase 2 — Integrate the universal JSON with the collector

Define only the JSON fields the existing collector truly needs, then adapt the collector incrementally to:

* Load `machine_config.json`.
* Create PLC tags from configuration rather than hard-coded customer tag names.
* Use standard signal names such as `running_state` and `fault_state`.
* Preserve connection-handling and polling behavior that already works.

### Phase 3 — Prove the collector and data model

Test the complete path:

```text
Configured PLC → collector → event detection → SQLite
```

The collector records meaningful state changes and events, not unchanged repeated values. The MVP targets events lasting approximately one second or longer; sub-second capture is not a requirement until customer use cases prove it is needed.

### Phase 4 — Connect and generalize the dashboard

Connect the validated SQLite data to the existing HAE dashboard. Verify production, state duration, faults, reconnection behavior, and duplicate-event prevention using real or simulated machine data.

Only after the end-to-end Rockwell path is working should the project expand to other PLC vendors, advanced analytics, AI-assisted mapping, cloud hosting, or SaaS features.

## 7. Deployment Principles

* Keep source code in a private GitHub repository.
* Use GitHub Actions to build and test the C# collector.
* Run the collector on a factory PC or internal server that can reach the PLC network.
* Deploy the production collector as a Windows Service rather than leaving a terminal open.
* GitHub does not directly poll factory PLCs; it stores source code and build releases.

## 8. Current Priority

```text
NOW: Tag Configurator browser MVP
NEXT: machine_config.json integration with the existing C# collector
THEN: validate event history and connect the existing analytics dashboard
```

The first complete vertical slice is:

```text
Rockwell L5K / CSV
→ Tag Configurator
→ machine_config.json
→ Existing PLC Collector
→ Existing SQLite database
→ Existing HAE Dashboard
```


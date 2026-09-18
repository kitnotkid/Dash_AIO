# Folder Structure

Repository: `kitnotkid/Dash_AIO`

All folders below are currently empty scaffolds (`.gitkeep` placeholders only),
mirroring the architecture in `docs/PROJECT_GUIDE.md` (§3, §10).

| Folder | Function |
|---|---|
| `apps/tag-configurator/` | Component 1 — browser app (HTML/CSS/TypeScript). Imports Rockwell L5K/CSV, lets the customer map PLC tags to universal machine signals, exports `machine_config.json`. |
| `apps/analytics-dashboard/` | Component 3 — browser app. Reads the collector's stored event history and computes/displays production, downtime, faults, OEE. |
| `services/plc-collector/` | Component 2 — C#/.NET service using libplctag. Loads `machine_config.json`, polls the PLC, detects state changes at write-time, stores raw events in SQLite. |
| `packages/machine-config-schema/` | Shared schema/types for `machine_config.json` — the contract between the Configurator and the Collector. |
| `docs/` | Project documentation — `PROJECT_GUIDE.md` (architecture/spec) and `typescript.md` (TypeScript conventions). |
| `tests/` | Test suite, shared/cross-component (empty so far). |
| `.github/workflows/` | CI — GitHub Actions to build/test the collector. |

## Build order

1. `apps/tag-configurator/`
2. `packages/machine-config-schema/` (finalize the JSON contract)
3. `services/plc-collector/`
4. `apps/analytics-dashboard/`

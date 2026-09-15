# TypeScript

TypeScript (`.ts`) is JavaScript with optional type checks.

The Tag Configurator will use TypeScript because it helps catch mistakes while parsing PLC files and generating `machine_config.json`.

Example:

```ts
type PlcTag = {
  name: string;
  dataType: "BOOL" | "DINT" | "REAL";
};
```

Browsers run JavaScript. The build process converts TypeScript into JavaScript before the web app is delivered.

## Where it will be used

- L5K and CSV parsing
- Tag search and filtering
- Mapping validation
- Machine configuration JSON export
- Automated parser tests

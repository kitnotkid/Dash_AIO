import type { CustomSignal, MachineEntry, MachineConfigFile, SignalKey, SignalMapping } from "./types.js";

export function buildMachineEntry(
  machineName: string,
  plcIp: string,
  mappings: Partial<Record<SignalKey, SignalMapping>>,
  customSignals: CustomSignal[]
): MachineEntry {
  const signals: MachineEntry["signals"] = {};
  for (const [key, mapping] of Object.entries(mappings)) {
    if (!mapping) continue;
    signals[key] = { tag: mapping.tag, data_type: mapping.assignedType };
  }
  for (const custom of customSignals) {
    signals[custom.key] = { tag: custom.tag, data_type: custom.assignedType };
  }

  return {
    machine: { name: machineName, plc: { vendor: "rockwell", ip: plcIp } },
    signals,
  };
}

export function buildMachineConfigFile(machines: MachineEntry[]): MachineConfigFile {
  return { schema_version: "1.0", machines };
}

export function normalizeImportedConfig(parsed: unknown): MachineEntry[] {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Not a valid machine_config.json file.");
  }
  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj.machines)) {
    return obj.machines as MachineEntry[];
  }
  if (obj.machine && obj.signals) {
    return [{ machine: obj.machine, signals: obj.signals } as MachineEntry];
  }
  throw new Error("Unrecognized machine_config.json shape.");
}

export function downloadMachineConfigFile(file: MachineConfigFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "machine_config.json";
  link.click();
  URL.revokeObjectURL(url);
}
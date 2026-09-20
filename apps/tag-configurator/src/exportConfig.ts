import type { CustomSignal, MachineConfig, SignalKey, SignalMapping } from "./types.js";

export function buildMachineConfig(
  machineName: string,
  plcIp: string,
  mappings: Partial<Record<SignalKey, SignalMapping>>,
  customSignals: CustomSignal[]
): MachineConfig {
  const signals: MachineConfig["signals"] = {};
  for (const [key, mapping] of Object.entries(mappings)) {
    if (!mapping) continue;
    signals[key] = { tag: mapping.tag, data_type: mapping.assignedType };
  }
  for (const custom of customSignals) {
    signals[custom.key] = { tag: custom.tag, data_type: custom.assignedType };
  }

  return {
    schema_version: "1.0",
    machine: {
      name: machineName,
      plc: { vendor: "rockwell", ip: plcIp },
    },
    signals,
  };
}

export function downloadMachineConfig(config: MachineConfig): void {
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "machine_config.json";
  link.click();
  URL.revokeObjectURL(url);
}

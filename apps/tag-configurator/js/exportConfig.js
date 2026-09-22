export function buildMachineEntry(machineName, plcIp, mappings, customSignals) {
    const signals = {};
    for (const [key, mapping] of Object.entries(mappings)) {
        if (!mapping)
            continue;
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
export function buildMachineConfigFile(machines) {
    return { schema_version: "1.0", machines };
}
export function normalizeImportedConfig(parsed) {
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Not a valid machine_config.json file.");
    }
    const obj = parsed;
    if (Array.isArray(obj.machines)) {
        return obj.machines;
    }
    if (obj.machine && obj.signals) {
        return [{ machine: obj.machine, signals: obj.signals }];
    }
    throw new Error("Unrecognized machine_config.json shape.");
}
export function downloadMachineConfigFile(file) {
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "machine_config.json";
    link.click();
    URL.revokeObjectURL(url);
}

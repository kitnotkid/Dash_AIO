import type { SignalKey, SignalMapping, DataType } from "./types.js";

export type SignalDef = {
  key: SignalKey;
  label: string;
  required: boolean;
};

export const UNIVERSAL_SIGNALS: SignalDef[] = [
  { key: "running_state", label: "Running State", required: true },
  { key: "stop_state", label: "Stop State", required: false },
  { key: "fault_state", label: "Fault State", required: true },
  { key: "cycle_complete", label: "Cycle Complete", required: false },
  { key: "production_count", label: "Production Count", required: true },
  { key: "good_count", label: "Good Count", required: false },
  { key: "reject_count", label: "Reject Count", required: false },
  { key: "auto_mode", label: "Auto Mode", required: false },
];

export function validateMappings(
  mappings: Partial<Record<SignalKey, SignalMapping>>
): string[] {
  const errors: string[] = [];

  for (const signal of UNIVERSAL_SIGNALS) {
    const mapping = mappings[signal.key];
    if (signal.required && !mapping) {
      errors.push(`${signal.label} is required but has no tag mapped.`);
      continue;
    }
    if (mapping && !mapping.tag.trim()) {
      errors.push(`${signal.label} has an empty tag.`);
    }
  }

  return errors;
}

export function isTypeMismatch(
  assignedType: DataType,
  suggestedType: DataType
): boolean {
  return assignedType !== suggestedType;
}

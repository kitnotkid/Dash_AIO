export type DataType = "BOOL" | "DINT" | "REAL";

export const DATA_TYPES: DataType[] = ["BOOL", "DINT", "REAL"];

export type PlcTag = {
  name: string;
  suggestedType: DataType | null;
};

export type SignalKey =
  | "running_state"
  | "stop_state"
  | "fault_state"
  | "cycle_complete"
  | "production_count"
  | "good_count"
  | "reject_count"
  | "auto_mode";

export type SignalMapping = {
  tag: string;
  assignedType: DataType;
};

export type MachineConfig = {
  schema_version: "1.0";
  machine: {
    name: string;
    plc: {
      vendor: "rockwell";
      ip: string;
    };
  };
  signals: Partial<Record<SignalKey, { tag: string; data_type: DataType }>>;
};

export type DraftState = {
  tags: PlcTag[];
  machineName: string;
  plcIp: string;
  mappings: Partial<Record<SignalKey, SignalMapping>>;
};

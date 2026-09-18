import type { DraftState, PlcTag, SignalKey, DataType } from "./types.js";
import { DATA_TYPES } from "./types.js";
import { parseL5K } from "./parseL5K.js";
import { parseCsv } from "./parseCsv.js";
import { UNIVERSAL_SIGNALS, validateMappings } from "./signals.js";
import { saveDraft, loadDraft, clearDraft } from "./storage.js";
import { buildMachineConfig, downloadMachineConfig } from "./exportConfig.js";

function emptyDraft(): DraftState {
  return { tags: [], machineName: "", plcIp: "", mappings: {} };
}

let state: DraftState = loadDraft() ?? emptyDraft();
let searchTerm = "";

const fileInput = document.getElementById("file-input") as HTMLInputElement;
const importStatus = document.getElementById("import-status")!;
const machineNameInput = document.getElementById("machine-name") as HTMLInputElement;
const plcIpInput = document.getElementById("plc-ip") as HTMLInputElement;
const tagSearchInput = document.getElementById("tag-search") as HTMLInputElement;
const tagListEl = document.getElementById("tag-list")!;
const mappingListEl = document.getElementById("mapping-list")!;
const validationErrorsEl = document.getElementById("validation-errors")!;
const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;

function persist(): void {
  saveDraft(state);
}

function findTag(name: string): PlcTag | undefined {
  return state.tags.find((tag) => tag.name === name);
}

function renderTagList(): void {
  const term = searchTerm.trim().toLowerCase();
  const filtered = term
    ? state.tags.filter((tag) => tag.name.toLowerCase().includes(term))
    : state.tags;

  tagListEl.innerHTML = filtered
    .map(
      (tag) =>
        `<div class="tag-row"><span class="mono">${tag.name}</span><span class="tag-type mono">${tag.suggestedType}</span></div>`
    )
    .join("");
}

function tagOptionsHtml(selected: string): string {
  const options = ['<option value="">-- select tag --</option>'];
  for (const tag of state.tags) {
    const isSelected = tag.name === selected ? " selected" : "";
    options.push(`<option value="${tag.name}"${isSelected}>${tag.name}</option>`);
  }
  return options.join("");
}

function typeOptionsHtml(selected: DataType): string {
  return DATA_TYPES.map(
    (type) => `<option value="${type}"${type === selected ? " selected" : ""}>${type}</option>`
  ).join("");
}

function renderMappingList(): void {
  mappingListEl.innerHTML = UNIVERSAL_SIGNALS.map((signal) => {
    const mapping = state.mappings[signal.key];
    const selectedTagName = mapping?.tag ?? "";
    const sourceTag = selectedTagName ? findTag(selectedTagName) : undefined;
    const assignedType = mapping?.assignedType ?? sourceTag?.suggestedType ?? "BOOL";
    const mismatch = sourceTag && assignedType !== sourceTag.suggestedType;

    return `
      <div class="mapping-row${mismatch ? " type-mismatch" : ""}" data-signal-key="${signal.key}">
        <span class="signal-label${signal.required ? " required" : ""}">${signal.label}</span>
        <select class="tag-select" data-signal-key="${signal.key}">${tagOptionsHtml(selectedTagName)}</select>
        <select class="assigned-type" data-signal-key="${signal.key}"${mapping ? "" : " disabled"}>${typeOptionsHtml(assignedType)}</select>
      </div>`;
  }).join("");
}

function renderValidation(): void {
  const errors = validateMappings(state.mappings);
  if (!state.machineName.trim()) errors.push("Machine name is required.");
  if (!state.plcIp.trim()) errors.push("PLC IP is required.");

  validationErrorsEl.innerHTML = errors.map((error) => `<li>${error}</li>`).join("");
  exportBtn.disabled = errors.length > 0;
}

function renderAll(): void {
  machineNameInput.value = state.machineName;
  plcIpInput.value = state.plcIp;
  renderTagList();
  renderMappingList();
  renderValidation();
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const text = await file.text();
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const tags = isCsv ? parseCsv(text) : parseL5K(text);

  state.tags = tags;

  const validNames = new Set(tags.map((tag) => tag.name));
  for (const key of Object.keys(state.mappings) as SignalKey[]) {
    const mapping = state.mappings[key];
    if (mapping && !validNames.has(mapping.tag)) {
      delete state.mappings[key];
    }
  }

  importStatus.textContent = `${tags.length} tag${tags.length === 1 ? "" : "s"} found in ${file.name}`;
  persist();
  renderAll();
});

tagSearchInput.addEventListener("input", () => {
  searchTerm = tagSearchInput.value;
  renderTagList();
});

machineNameInput.addEventListener("input", () => {
  state.machineName = machineNameInput.value;
  persist();
  renderValidation();
});

plcIpInput.addEventListener("input", () => {
  state.plcIp = plcIpInput.value;
  persist();
  renderValidation();
});

mappingListEl.addEventListener("change", (event) => {
  const target = event.target as HTMLSelectElement;
  const key = target.dataset.signalKey as SignalKey | undefined;
  if (!key) return;

  if (target.classList.contains("tag-select")) {
    const tagName = target.value;
    if (!tagName) {
      delete state.mappings[key];
    } else {
      const sourceTag = findTag(tagName);
      state.mappings[key] = {
        tag: tagName,
        assignedType: sourceTag?.suggestedType ?? "BOOL",
      };
    }
  } else if (target.classList.contains("assigned-type")) {
    const mapping = state.mappings[key];
    if (mapping) mapping.assignedType = target.value as DataType;
  }

  persist();
  renderMappingList();
  renderValidation();
});

exportBtn.addEventListener("click", () => {
  const config = buildMachineConfig(state.machineName, state.plcIp, state.mappings);
  downloadMachineConfig(config);
});

clearBtn.addEventListener("click", () => {
  clearDraft();
  state = emptyDraft();
  searchTerm = "";
  tagSearchInput.value = "";
  importStatus.textContent = "";
  fileInput.value = "";
  renderAll();
});

renderAll();

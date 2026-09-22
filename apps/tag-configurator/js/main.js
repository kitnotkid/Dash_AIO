import { DATA_TYPES } from "./types.js";
import { parseL5K } from "./parseL5K.js";
import { parseCsv } from "./parseCsv.js";
import { UNIVERSAL_SIGNALS, validateMappings, validateCustomSignals, isTypeMismatch, slugify } from "./signals.js";
import { saveDraft, loadDraft, clearDraft } from "./storage.js";
import { buildMachineEntry, buildMachineConfigFile, normalizeImportedConfig, downloadMachineConfigFile } from "./exportConfig.js";
function emptyDraft() {
    return { tags: [], machineName: "", plcIp: "", mappings: {}, customSignals: [], machines: [], editingIndex: null };
}
let state = loadDraft() ?? emptyDraft();
state.customSignals ?? (state.customSignals = []);
state.machines ?? (state.machines = []);
state.editingIndex ?? (state.editingIndex = null);
let searchTerm = "";
let customSignalIdCounter = 0;
const fileInput = document.getElementById("file-input");
const importStatus = document.getElementById("import-status");
const machineNameInput = document.getElementById("machine-name");
const plcIpInput = document.getElementById("plc-ip");
const tagSearchInput = document.getElementById("tag-search");
const tagListEl = document.getElementById("tag-list");
const mappingListEl = document.getElementById("mapping-list");
const tagOptionsDatalist = document.getElementById("tag-options-list");
const validationErrorsEl = document.getElementById("validation-errors");
const exportBtn = document.getElementById("export-btn");
const clearBtn = document.getElementById("clear-btn");
const customSignalListEl = document.getElementById("custom-signal-list");
const addSignalBtn = document.getElementById("add-signal-btn");
const configFileInput = document.getElementById("config-file-input");
const savedMachinesEl = document.getElementById("saved-machines");
const saveMachineBtn = document.getElementById("save-machine-btn");
function persist() {
    saveDraft(state);
}
async function readFileAsText(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Studio 5000 / RSLogix "Export CSV" commonly saves as UTF-16 (Unicode).
    // file.text() always assumes UTF-8, which mangles UTF-16 into a null byte
    // after every character and silently breaks header detection. Sniff the
    // BOM so we pick the encoding the file actually used.
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(buffer);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(buffer);
    }
    return new TextDecoder("utf-8").decode(buffer);
}
function findTag(name) {
    return state.tags.find((tag) => tag.name === name);
}
function renderTagList() {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
        ? state.tags.filter((tag) => tag.name.toLowerCase().includes(term))
        : state.tags;
    tagListEl.innerHTML = filtered
        .map((tag) => `<div class="tag-row"><span class="mono">${tag.name}</span><span class="tag-type mono${tag.suggestedType ? ` type-${tag.suggestedType.toLowerCase()}` : ""}">${tag.suggestedType ?? "—"}</span></div>`)
        .join("");
}
function renderTagOptionsDatalist() {
    tagOptionsDatalist.innerHTML = state.tags
        .map((tag) => `<option value="${tag.name}"></option>`)
        .join("");
}
function typeOptionsHtml(selected) {
    return DATA_TYPES.map((type) => `<option value="${type}"${type === selected ? " selected" : ""}>${type}</option>`).join("");
}
function renderMappingList() {
    renderTagOptionsDatalist();
    mappingListEl.innerHTML = UNIVERSAL_SIGNALS.map((signal) => {
        const mapping = state.mappings[signal.key];
        const selectedTagName = mapping?.tag ?? "";
        const sourceTag = selectedTagName ? findTag(selectedTagName) : undefined;
        const assignedType = mapping?.assignedType ?? sourceTag?.suggestedType ?? "BOOL";
        const mismatch = sourceTag && isTypeMismatch(assignedType, sourceTag.suggestedType);
        return `
      <div class="mapping-row${mismatch ? " type-mismatch" : ""}" data-signal-key="${signal.key}">
        <span class="signal-label${signal.required ? " required" : ""}">${signal.label}</span>
        <input type="text" class="tag-select" list="tag-options-list" data-signal-key="${signal.key}" value="${selectedTagName}" placeholder="Type or select tag..." autocomplete="off" />
        <select class="assigned-type" data-signal-key="${signal.key}"${mapping ? "" : " disabled"}>${typeOptionsHtml(assignedType)}</select>
      </div>`;
    }).join("");
}
function renderCustomSignalList() {
    customSignalListEl.innerHTML = state.customSignals
        .map((signal) => `
      <div class="mapping-row" data-signal-id="${signal.id}">
        <input type="text" class="custom-signal-name" data-signal-id="${signal.id}" value="${signal.label}" placeholder="Signal name" />
        <input type="text" class="custom-signal-tag" list="tag-options-list" data-signal-id="${signal.id}" value="${signal.tag}" placeholder="Type or select tag..." autocomplete="off" />
        <select class="custom-signal-type" data-signal-id="${signal.id}">${typeOptionsHtml(signal.assignedType)}</select>
        <button type="button" class="remove-signal-btn" data-signal-id="${signal.id}" aria-label="Remove signal">&times;</button>
      </div>`)
        .join("");
}
function configuredSignalLabel(key) {
    const universal = UNIVERSAL_SIGNALS.find((s) => s.key === key);
    return universal ? universal.label : key;
}
function renderSavedMachines() {
    savedMachinesEl.innerHTML = state.machines.length
        ? state.machines
            .map((m, i) => {
            const keys = Object.keys(m.signals);
            const chips = keys.length
                ? keys.map((key) => `<span class="signal-chip">${configuredSignalLabel(key)}</span>`).join("")
                : `<span class="signal-chip signal-chip-empty">No signals configured</span>`;
            return `
      <div class="machine-card${i === state.editingIndex ? " editing" : ""}">
        <div class="machine-card-head">
          <span class="machine-ip mono">${m.machine.plc.ip}</span>
          <span class="mono machine-edit-target" data-machine-index="${i}" style="cursor:pointer;text-decoration:underline;">${m.machine.name}${i === state.editingIndex ? " (editing)" : ""}</span>
          <button type="button" class="remove-machine-btn" data-machine-index="${i}" aria-label="Remove machine">&times;</button>
        </div>
        <div class="machine-card-signals">${chips}</div>
      </div>`;
        })
            .join("")
        : `<p class="status-text">No machines saved yet.</p>`;
}
function renderValidation() {
    const errors = validateMappings(state.mappings);
    errors.push(...validateCustomSignals(state.customSignals));
    if (!state.machineName.trim())
        errors.push("Machine name is required.");
    if (!state.plcIp.trim())
        errors.push("PLC IP is required.");
    validationErrorsEl.innerHTML = errors.map((error) => `<li>${error}</li>`).join("");
    saveMachineBtn.disabled = errors.length > 0;
    saveMachineBtn.textContent = state.editingIndex !== null ? "Update machine" : "Save machine";
    exportBtn.disabled = state.machines.length === 0;
    exportBtn.textContent = `Download machine_config.json (${state.machines.length} machine${state.machines.length === 1 ? "" : "s"})`;
}
function renderAll() {
    machineNameInput.value = state.machineName;
    plcIpInput.value = state.plcIp;
    renderTagList();
    renderMappingList();
    renderCustomSignalList();
    renderSavedMachines();
    renderValidation();
}
fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file)
        return;
    const text = await readFileAsText(file);
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const tags = isCsv ? parseCsv(text) : parseL5K(text);
    state.tags = tags;
    const validNames = new Set(tags.map((tag) => tag.name));
    for (const key of Object.keys(state.mappings)) {
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
    const target = event.target;
    const key = target.dataset.signalKey;
    if (!key)
        return;
    if (target.classList.contains("tag-select")) {
        const tagName = target.value;
        if (!tagName) {
            delete state.mappings[key];
        }
        else {
            const sourceTag = findTag(tagName);
            state.mappings[key] = {
                tag: tagName,
                assignedType: sourceTag?.suggestedType ?? "BOOL",
            };
        }
    }
    else if (target.classList.contains("assigned-type")) {
        const mapping = state.mappings[key];
        if (mapping)
            mapping.assignedType = target.value;
    }
    persist();
    renderMappingList();
    renderValidation();
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
addSignalBtn.addEventListener("click", () => {
    customSignalIdCounter += 1;
    state.customSignals.push({
        id: `custom-${customSignalIdCounter}`,
        key: "",
        label: "",
        tag: "",
        assignedType: "BOOL",
    });
    persist();
    renderCustomSignalList();
    renderValidation();
});
customSignalListEl.addEventListener("change", (event) => {
    const target = event.target;
    const id = target.dataset.signalId;
    const signal = state.customSignals.find((s) => s.id === id);
    if (!signal)
        return;
    if (target.classList.contains("custom-signal-name")) {
        signal.label = target.value;
        signal.key = slugify(target.value);
    }
    else if (target.classList.contains("custom-signal-tag")) {
        signal.tag = target.value;
    }
    else if (target.classList.contains("custom-signal-type")) {
        signal.assignedType = target.value;
    }
    persist();
    renderValidation();
});
customSignalListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("remove-signal-btn"))
        return;
    const id = target.dataset.signalId;
    state.customSignals = state.customSignals.filter((s) => s.id !== id);
    persist();
    renderCustomSignalList();
    renderValidation();
});
saveMachineBtn.addEventListener("click", () => {
    const trimmedIp = state.plcIp.trim();
    const collision = state.machines.some((m, i) => m.machine.plc.ip === trimmedIp && i !== state.editingIndex);
    if (collision) {
        alert(`A machine with IP "${trimmedIp}" is already saved in this config. Choose a different IP or edit that existing machine instead.`);
        importStatus.textContent = `Blocked: IP "${trimmedIp}" is already used by another saved machine.`;
        return;
    }
    const entry = buildMachineEntry(state.machineName, state.plcIp, state.mappings, state.customSignals);
    if (state.editingIndex !== null) {
        state.machines[state.editingIndex] = entry;
        importStatus.textContent = `Machine "${state.machineName.trim()}" updated.`;
    }
    else {
        state.machines.push(entry);
        importStatus.textContent = `Machine saved. ${state.machines.length} machine${state.machines.length === 1 ? "" : "s"} in this config — upload the next PLC export to continue.`;
    }
    state.editingIndex = null;
    state.tags = [];
    state.machineName = "";
    state.plcIp = "";
    state.mappings = {};
    state.customSignals = [];
    searchTerm = "";
    tagSearchInput.value = "";
    fileInput.value = "";
    persist();
    renderAll();
});
function loadMachineForEditing(index) {
    const entry = state.machines[index];
    if (!entry)
        return;
    const universalKeys = new Set(UNIVERSAL_SIGNALS.map((s) => s.key));
    const mappings = {};
    const customSignals = [];
    for (const [key, signal] of Object.entries(entry.signals)) {
        if (universalKeys.has(key)) {
            mappings[key] = { tag: signal.tag, assignedType: signal.data_type };
        }
        else {
            customSignalIdCounter += 1;
            customSignals.push({ id: `custom-${customSignalIdCounter}`, key, label: key, tag: signal.tag, assignedType: signal.data_type });
        }
    }
    state.editingIndex = index;
    state.machineName = entry.machine.name;
    state.plcIp = entry.machine.plc.ip;
    state.mappings = mappings;
    state.customSignals = customSignals;
    importStatus.textContent = `Editing "${entry.machine.name}". Re-import its PLC export if you need tag autocomplete, then click Update machine.`;
    persist();
    renderAll();
}
exportBtn.addEventListener("click", () => {
    downloadMachineConfigFile(buildMachineConfigFile(state.machines));
});
configFileInput.addEventListener("change", async () => {
    const file = configFileInput.files?.[0];
    if (!file)
        return;
    if (state.machines.length > 0) {
        const proceed = confirm(`This config already has ${state.machines.length} saved machine${state.machines.length === 1 ? "" : "s"} in this session.\n\n` +
            `Uploading "${file.name}" will ADD its machines to that list (any with a matching name are skipped, not overwritten).\n\nContinue?`);
        if (!proceed) {
            configFileInput.value = "";
            return;
        }
    }
    try {
        const incoming = normalizeImportedConfig(JSON.parse(await file.text()));
        let added = 0, skipped = 0;
        for (const entry of incoming) {
            if (state.machines.some((m) => m.machine.plc.ip === entry.machine.plc.ip)) {
                skipped++;
                continue;
            }
            state.machines.push(entry);
            added++;
        }
        importStatus.textContent = `Appended ${added} machine${added === 1 ? "" : "s"} from ${file.name}` +
            (skipped > 0 ? ` (${skipped} skipped: IP already in this config).` : ".");
        persist();
        renderAll();
    }
    catch {
        importStatus.textContent = `Could not read ${file.name} as a machine_config.json file.`;
    }
    finally {
        configFileInput.value = "";
    }
});
savedMachinesEl.addEventListener("click", (event) => {
    const target = event.target;
    const index = Number(target.dataset.machineIndex);
    if (Number.isNaN(index))
        return;
    if (target.classList.contains("remove-machine-btn")) {
        state.machines.splice(index, 1);
        if (state.editingIndex === index)
            state.editingIndex = null;
        else if (state.editingIndex !== null && state.editingIndex > index)
            state.editingIndex -= 1;
        persist();
        renderAll();
        return;
    }
    if (target.classList.contains("machine-edit-target")) {
        loadMachineForEditing(index);
    }
});
renderAll();

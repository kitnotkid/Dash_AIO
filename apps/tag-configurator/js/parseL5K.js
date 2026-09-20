import { normalizeType } from "./normalizeType.js";
const TAG_DECL = /^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)/;
const DATATYPE_START = /^\s*DATATYPE\s+(\S+)/;
const END_DATATYPE = /^\s*END_DATATYPE/;
const BIT_MEMBER = /^\s*BIT\s+([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*\d+\s*(?:\(([^)]*)\))?;?\s*$/;
const ELEMENTARY_MEMBER = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?;?\s*$/;
function parseUdtDefs(text) {
    const defs = new Map();
    let currentName = null;
    let currentMembers = [];
    for (const line of text.split(/\r?\n/)) {
        const startMatch = DATATYPE_START.exec(line);
        if (startMatch) {
            currentName = startMatch[1];
            currentMembers = [];
            continue;
        }
        if (currentName === null)
            continue;
        if (END_DATATYPE.test(line)) {
            defs.set(currentName, currentMembers);
            currentName = null;
            continue;
        }
        const bitMatch = BIT_MEMBER.exec(line);
        if (bitMatch) {
            currentMembers.push({ name: bitMatch[1], type: "BOOL" });
            continue;
        }
        const elemMatch = ELEMENTARY_MEMBER.exec(line);
        if (elemMatch) {
            const [, type, name, attrs] = elemMatch;
            if (attrs && /Hidden\s*:=\s*1/.test(attrs))
                continue;
            currentMembers.push({ name: name, type: type });
        }
    }
    return defs;
}
function resolveMembers(udtName, defs, visited) {
    const members = defs.get(udtName);
    if (!members)
        return [];
    const resolved = [];
    for (const member of members) {
        const elementary = normalizeType(member.type);
        if (elementary) {
            resolved.push({ path: member.name, suggestedType: elementary });
            continue;
        }
        if (defs.has(member.type) && !visited.has(member.type)) {
            const nested = resolveMembers(member.type, defs, new Set([...visited, member.type]));
            for (const n of nested) {
                resolved.push({ path: `${member.name}.${n.path}`, suggestedType: n.suggestedType });
            }
            continue;
        }
        resolved.push({ path: member.name, suggestedType: null });
    }
    return resolved;
}
export function parseL5K(text) {
    const udtDefs = parseUdtDefs(text);
    const tags = new Map();
    for (const line of text.split(/\r?\n/)) {
        const match = TAG_DECL.exec(line);
        if (!match)
            continue;
        const [, name, rawType] = match;
        if (!name || !rawType)
            continue;
        const elementary = normalizeType(rawType);
        if (elementary) {
            if (!tags.has(name))
                tags.set(name, { name, suggestedType: elementary });
            continue;
        }
        if (udtDefs.has(rawType)) {
            for (const member of resolveMembers(rawType, udtDefs, new Set([rawType]))) {
                const memberName = `${name}.${member.path}`;
                if (!tags.has(memberName)) {
                    tags.set(memberName, { name: memberName, suggestedType: member.suggestedType });
                }
            }
            continue;
        }
        if (!tags.has(name)) {
            tags.set(name, { name, suggestedType: null });
        }
    }
    return [...tags.values()];
}

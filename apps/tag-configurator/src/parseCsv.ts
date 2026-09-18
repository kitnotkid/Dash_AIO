import type { PlcTag } from "./types.js";
import { normalizeType } from "./normalizeType.js";

const NAME_HEADERS = ["tag", "tag name", "name"];
const STRICT_TYPE_HEADERS = ["data type", "datatype"];
const FALLBACK_TYPE_HEADERS = ["type"];
const ENTRY_TYPE_HEADER = "type";
const INCLUDED_ENTRY_TYPES = new Set(["tag", "alias"]);

function splitRow(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function stripArraySuffix(rawType: string): string {
  return rawType.replace(/\[.*\]$/, "");
}

function findHeader(lines: string[], typeHeaders: string[]) {
  const header = splitRow(lines[0]!).map((cell) => cell.toLowerCase());
  const nameCol = header.findIndex((cell) => NAME_HEADERS.includes(cell));
  const typeCol = header.findIndex((cell) => typeHeaders.includes(cell));
  if (nameCol === -1 || typeCol === -1) return null;
  return { header, nameCol, typeCol };
}

export function parseCsv(text: string): PlcTag[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const found = findHeader(lines, STRICT_TYPE_HEADERS) ?? findHeader(lines, FALLBACK_TYPE_HEADERS);
  if (!found) return [];

  const { header, nameCol, typeCol } = found;
  const entryTypeCol = header.findIndex((cell) => cell === ENTRY_TYPE_HEADER);
  const tags = new Map<string, PlcTag>();

  for (const line of lines.slice(1)) {
    const cells = splitRow(line);

    if (entryTypeCol !== -1 && entryTypeCol !== typeCol) {
      const entryType = cells[entryTypeCol]?.toLowerCase();
      if (!entryType || !INCLUDED_ENTRY_TYPES.has(entryType)) continue;
    }

    const name = cells[nameCol];
    if (!name) continue;

    const rawType = cells[typeCol];
    const suggestedType = rawType ? normalizeType(stripArraySuffix(rawType)) : null;

    if (!tags.has(name)) {
      tags.set(name, { name, suggestedType });
    }
  }

  return [...tags.values()];
}

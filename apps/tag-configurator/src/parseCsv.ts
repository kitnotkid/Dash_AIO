import type { PlcTag } from "./types.js";
import { normalizeType } from "./normalizeType.js";

const NAME_HEADERS = ["tag", "tag name", "name"];
const TYPE_HEADERS = ["data type", "datatype", "type"];

function splitRow(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

export function parseCsv(text: string): PlcTag[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = splitRow(lines[0]!).map((cell) => cell.toLowerCase());
  const nameCol = header.findIndex((cell) => NAME_HEADERS.includes(cell));
  const typeCol = header.findIndex((cell) => TYPE_HEADERS.includes(cell));
  if (nameCol === -1 || typeCol === -1) return [];

  const tags = new Map<string, PlcTag>();

  for (const line of lines.slice(1)) {
    const cells = splitRow(line);
    const name = cells[nameCol];
    const rawType = cells[typeCol];
    if (!name || !rawType) continue;

    const suggestedType = normalizeType(rawType);
    if (!suggestedType) continue;

    if (!tags.has(name)) {
      tags.set(name, { name, suggestedType });
    }
  }

  return [...tags.values()];
}

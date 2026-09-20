import type { PlcTag } from "./types.js";
import { normalizeType } from "./normalizeType.js";

const NAME_HEADERS = ["tag", "tag name", "name"];
const STRICT_TYPE_HEADERS = ["data type", "datatype"];
const FALLBACK_TYPE_HEADERS = ["type"];
const ENTRY_TYPE_HEADER = "type";
const ALLOWED_ENTRY_TYPES = new Set(["tag", "alias"]);

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((cell) => cell.trim());
}

function stripArraySuffix(rawType: string): string {
  return rawType.replace(/\[.*\]$/, "");
}

function findHeader(lines: string[], typeHeaders: string[]) {
  for (let i = 0; i < lines.length; i++) {
    const cells = splitRow(lines[i]!).map((cell) => cell.toLowerCase());
    const nameCol = cells.findIndex((cell) => NAME_HEADERS.includes(cell));
    const typeCol = cells.findIndex((cell) => typeHeaders.includes(cell));
    if (nameCol !== -1 && typeCol !== -1) {
      return { headerIndex: i, header: cells, nameCol, typeCol };
    }
  }
  return null;
}

export function parseCsv(text: string): PlcTag[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  const found = findHeader(lines, STRICT_TYPE_HEADERS) ?? findHeader(lines, FALLBACK_TYPE_HEADERS);
  if (!found) return [];

  const { headerIndex, header, nameCol, typeCol } = found;
  const entryTypeCol = header.findIndex((cell) => cell === ENTRY_TYPE_HEADER);
  const tags = new Map<string, PlcTag>();

  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitRow(line);

    if (entryTypeCol !== -1 && entryTypeCol !== typeCol && !ALLOWED_ENTRY_TYPES.has(cells[entryTypeCol]?.toLowerCase() ?? "")) {
      continue;
    }

    const name = cells[nameCol];
    if (!name) continue;

    const suggestedType = normalizeType(stripArraySuffix(cells[typeCol] ?? ""));
    if (!tags.has(name)) {
      tags.set(name, { name, suggestedType });
    }
  }

  return [...tags.values()];
}

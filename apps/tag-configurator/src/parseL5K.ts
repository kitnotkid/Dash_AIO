import type { PlcTag } from "./types.js";
import { normalizeType } from "./normalizeType.js";

const TAG_DECL = /^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)/;

export function parseL5K(text: string): PlcTag[] {
  const tags = new Map<string, PlcTag>();

  for (const line of text.split(/\r?\n/)) {
    const match = TAG_DECL.exec(line);
    if (!match) continue;

    const [, name, rawType] = match;
    if (!name || !rawType) continue;
    const suggestedType = normalizeType(rawType);
    if (!suggestedType) continue;

    if (!tags.has(name)) {
      tags.set(name, { name, suggestedType });
    }
  }

  return [...tags.values()];
}

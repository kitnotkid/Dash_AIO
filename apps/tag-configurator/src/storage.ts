import type { DraftState } from "./types.js";

const STORAGE_KEY = "tag-configurator:draft";

export function saveDraft(draft: DraftState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(): DraftState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(STORAGE_KEY);
}

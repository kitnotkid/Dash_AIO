const STORAGE_KEY = "tag-configurator:draft";
export function saveDraft(draft) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}
export function loadDraft() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function clearDraft() {
    localStorage.removeItem(STORAGE_KEY);
}

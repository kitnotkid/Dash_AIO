const ALIASES = {
    BOOL: "BOOL",
    BIT: "BOOL",
    REAL: "REAL",
    FLOAT: "REAL",
    DINT: "DINT",
    // Rockwell also exports SINT/INT/LINT; the configurator only distinguishes
    // BOOL/DINT/REAL (per docs/PROJECT_GUIDE.md §4), so other integer widths
    // fall back to DINT as the closest bucket.
    SINT: "DINT",
    INT: "DINT",
    LINT: "DINT",
};
export function normalizeType(raw) {
    const key = raw.trim().toUpperCase();
    return ALIASES[key] ?? null;
}

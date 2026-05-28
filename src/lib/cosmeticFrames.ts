export function normalizeCosmeticFrameId(frameId?: string): string {
  return String(frameId ?? "")
    .trim()
    .toLowerCase()
    .replace(/^frame-/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

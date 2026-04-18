export function createFrameUid(value: string, maxLength = 32): string {
  return value.replace(/[^a-z0-9_-]/gi, "").slice(0, maxLength) || "frame";
}

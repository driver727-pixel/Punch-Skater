interface ResolveUserDisplayNameInput {
  profileDisplayName?: string | null;
  authDisplayName?: string | null;
  email?: string | null;
  fallbackName?: string;
}

function normalizeName(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveUserDisplayName({
  profileDisplayName,
  authDisplayName,
  email,
  fallbackName = "Skater",
}: ResolveUserDisplayNameInput): string {
  const fromProfile = normalizeName(profileDisplayName);
  if (fromProfile) return fromProfile;

  const fromAuth = normalizeName(authDisplayName);
  if (fromAuth) return fromAuth;

  const emailValue = normalizeName(email);
  if (emailValue) {
    const stem = emailValue.split("@")[0]?.trim();
    if (stem) return stem;
  }

  return fallbackName;
}

export function resolveUserInitial(displayName: string, fallback = "S"): string {
  const value = normalizeName(displayName);
  const char = [...value][0] ?? fallback;
  return char.toUpperCase();
}

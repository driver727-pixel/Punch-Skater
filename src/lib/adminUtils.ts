/** Fallback admin email when VITE_ADMIN_EMAILS is not configured. */
const DEFAULT_ADMIN_EMAILS = ["driver727@gmail.com"];

/** Returns the list of admin email addresses from the environment variable. */
export function getAdminEmails(): string[] {
  const env = (import.meta.env.VITE_ADMIN_EMAILS ?? "").trim();
  if (!env) return DEFAULT_ADMIN_EMAILS;
  return env
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns true when the given email belongs to an admin account. */
export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

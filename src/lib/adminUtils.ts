/** Returns the list of admin email addresses from the environment variable. */
export function getAdminEmails(): string[] {
  return (import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns true when the given email belongs to an admin account. */
export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

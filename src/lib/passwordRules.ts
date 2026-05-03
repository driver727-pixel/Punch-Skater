export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.";
export const PASSWORD_REQUIREMENTS_PLACEHOLDER =
  `Min. ${PASSWORD_MIN_LENGTH} chars (mixed case, number, symbol)`;

export function isStrongPassword(password: string): boolean {
  return typeof password === "string"
    && password.length >= PASSWORD_MIN_LENGTH
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

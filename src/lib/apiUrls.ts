const IMAGE_API_URL = (import.meta.env.VITE_IMAGE_API_URL as string | undefined)?.trim();
const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_URL as string | undefined)?.trim();

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function resolveApiUrl(
  configuredUrl: string | undefined,
  fallbackPath: string,
): string {
  const trimmedConfiguredUrl = configuredUrl?.trim();
  if (trimmedConfiguredUrl) return trimmedConfiguredUrl;

  if (IMAGE_API_URL && isAbsoluteUrl(IMAGE_API_URL)) {
    try {
      return new URL(fallbackPath, IMAGE_API_URL).toString();
    } catch {
      // Fall through to the local relative path.
    }
  }

  return fallbackPath;
}

/**
 * Resolves an admin API pathname to an absolute URL.
 *
 * Resolution order:
 * 1. VITE_ADMIN_API_URL  – explicit admin server override
 * 2. VITE_IMAGE_API_URL  – inferred from the image-gen server (same host)
 * 3. pathname as-is      – relative URL for local dev via Vite proxy
 *
 * This ensures admin API calls reach the correct backend when the app is
 * deployed to a static host (e.g. GitHub Pages) and the API server is
 * separate (e.g. Render), even when VITE_ADMIN_API_URL is not explicitly set.
 */
export function resolveAdminActionUrl(pathname: string): string {
  if (ADMIN_API_BASE_URL) {
    try {
      return new URL(pathname, ADMIN_API_BASE_URL).toString();
    } catch {
      // fall through
    }
  }

  if (IMAGE_API_URL && isAbsoluteUrl(IMAGE_API_URL)) {
    try {
      return new URL(pathname, IMAGE_API_URL).toString();
    } catch {
      // fall through
    }
  }

  return pathname;
}

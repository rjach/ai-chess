import "server-only";

/**
 * /api/move spends the user's Claude, ChatGPT or OpenRouter quota, so it only accepts JSON from this app's own pages.
 * Requiring application/json forces a CORS preflight for any cross-site caller, and the Origin check rejects
 * the rest, so another website open in the same browser cannot start CLI runs.
 */
export function isTrustedJsonRequest(request: Request): boolean {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

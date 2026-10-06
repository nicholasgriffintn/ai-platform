import type { SandboxPreviewAccess } from "@ngriffin_uk/polychat-schemas";

import type { PollInterval } from "../sync/live-or-poll.js";

export function sandboxPreviewRefreshInterval(
  access: Pick<SandboxPreviewAccess, "state" | "expiresAt"> | undefined,
  fallback: PollInterval,
  now = Date.now(),
): PollInterval {
  if (!access || (access.state !== "healthy" && access.state !== "starting")) {
    return false;
  }

  const expiresAt = Date.parse(access.expiresAt);
  const boundary = Number.isFinite(expiresAt)
    ? Math.max(1_000, Math.min(86_400_000, expiresAt - now + 1_000))
    : 60_000;

  return Math.min(fallback || Number.POSITIVE_INFINITY, boundary);
}

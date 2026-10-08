import { toast } from "sonner";

const CHUNK_RELOAD_KEY = "polychat:chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN_MS = 5 * 60 * 1000;
const UPDATE_TOAST_ID = "polychat-client-update";

export function shouldReloadForChunkError(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt > CHUNK_RELOAD_COOLDOWN_MS;
}

function readLastChunkReload(): number | null {
  try {
    const value = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY));

    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function reloadAfterChunkError(now = Date.now()): boolean {
  if (!shouldReloadForChunkError(readLastChunkReload(), now)) {
    return false;
  }

  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }

  window.location.reload();

  return true;
}

export async function fetchDeployedBuildId(): Promise<string | null> {
  try {
    const response = await fetch("/version.json", { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();

    return typeof body === "object" &&
      body !== null &&
      "buildId" in body &&
      typeof body.buildId === "string"
      ? body.buildId
      : null;
  } catch {
    return null;
  }
}

export function announceClientUpdate(onRefresh: () => void): void {
  toast("A fresher Polychat has landed", {
    id: UPDATE_TOAST_ID,
    description: "Refresh when it suits you.",
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Refresh", onClick: onRefresh },
  });
}

const BRIDGE_UNAVAILABLE =
  "The desktop bridge is not available. Open Polychat from the application rather than a browser tab.";

export function getDesktopSignInMessage(cause: unknown): string {
  const detail = (cause instanceof Error ? cause.message : String(cause)).trim();

  if (!detail) {
    return "Sign-in did not finish. Try again.";
  }

  if (detail.includes("invoke") || detail.includes("__TAURI")) {
    return BRIDGE_UNAVAILABLE;
  }

  return detail;
}

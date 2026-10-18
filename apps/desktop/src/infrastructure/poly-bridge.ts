import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export const OPEN_POLY_EVENT = "polychat://open-poly";
export const PERCH_WINDOW_LABEL = "perch";

export function isPerchWindow(): boolean {
  try {
    return getCurrentWebviewWindow().label === PERCH_WINDOW_LABEL;
  } catch {
    return false;
  }
}

export function showPolyPresence(status: string, needsYou: number): Promise<void> {
  return invoke("set_poly_presence", { status, needsYou });
}

export function openPolyWindow(): Promise<void> {
  return invoke("open_poly_window");
}

export function hidePolyPerch(): Promise<void> {
  return invoke("set_poly_perch", { visible: false });
}

export function onOpenPoly(open: () => void): () => void {
  let stopped = false;
  let stop: (() => void) | undefined;

  const subscribe = async () => {
    const unlisten = await listen(OPEN_POLY_EVENT, () => {
      if (!stopped) {
        open();
      }
    });

    stop = unlisten;

    if (stopped) {
      unlisten();
    }
  };

  subscribe().catch(() => undefined);

  return () => {
    stopped = true;
    stop?.();
  };
}

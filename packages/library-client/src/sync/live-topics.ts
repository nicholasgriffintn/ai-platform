import type { DeviceSyncSocket } from "./socket.js";
import { useSyncStore } from "./syncStore.js";

let activeSocket: DeviceSyncSocket | undefined;

export function setActiveSyncSocket(socket: DeviceSyncSocket | undefined): void {
  activeSocket = socket;
}

export function getActiveSyncSocket(): DeviceSyncSocket | undefined {
  return activeSocket;
}

export async function waitForSyncEvent(
  topic: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const socket = activeSocket;

  if (!socket?.isOpen()) {
    await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

    return;
  }

  socket.subscribe([topic]);

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener("abort", finish);
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    const unsubscribe = useSyncStore.subscribe((state, previous) => {
      if (state.lastEventAt !== previous.lastEventAt && state.lastEventTopic === topic) {
        finish();
      }
    });

    signal?.addEventListener("abort", finish, { once: true });
  });
}

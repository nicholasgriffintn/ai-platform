import {
  deviceSyncServerMessageSchema,
  type DeviceSyncClientMessage,
  type DeviceSyncEvent,
  type DeviceSyncGrantResponse,
  type DeviceSyncPresenceEntry,
  type DeviceSyncServerMessage,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "../api-service.js";
import { fetchApiOrThrow } from "../fetch-wrapper.js";
import { returnFetchedData } from "../http.js";
import { getDeviceId } from "./device-identity.js";

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

export type SyncStatus = "idle" | "connecting" | "open" | "closed";

export interface SyncSocketListeners {
  onEvent: (event: DeviceSyncEvent) => void;
  onReset: (topic: string, seq: number) => void;
  onPresence: (topic: string, devices: DeviceSyncPresenceEntry[]) => void;
  onStatus: (status: SyncStatus) => void;
}

async function requestGrant(deviceId: string): Promise<DeviceSyncGrantResponse> {
  const response = await fetchApiOrThrow("/sync/grant", {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: { deviceId },
  });

  return returnFetchedData<DeviceSyncGrantResponse>(response);
}

export class DeviceSyncSocket {
  private socket: WebSocket | undefined;
  private retryMs = INITIAL_RETRY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private cursors = new Map<string, number>();
  private topics = new Set<string>();
  private focusedTopic: string | null = null;
  private stopped = true;
  private status: SyncStatus = "idle";

  constructor(private readonly listeners: SyncSocketListeners) {}

  private setStatus(status: SyncStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.listeners.onStatus(status);
    }
  }

  private send(message: DeviceSyncClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private resubscribe(): void {
    if (this.topics.size === 0) {
      return;
    }

    this.send({
      type: "subscribe",
      topics: [...this.topics].map((topic) => ({
        topic,
        lastSeq: this.cursors.get(topic) ?? 0,
      })),
    });

    if (this.focusedTopic) {
      this.send({ type: "focus", topic: this.focusedTopic });
    }
  }

  private handle(message: DeviceSyncServerMessage): void {
    if (message.type === "event") {
      this.cursors.set(message.event.topic, message.event.seq);
      this.listeners.onEvent(message.event);

      return;
    }

    if (message.type === "subscribed") {
      this.cursors.set(message.topic, message.seq);

      return;
    }

    if (message.type === "reset") {
      this.cursors.set(message.topic, message.seq);
      this.listeners.onReset(message.topic, message.seq);

      return;
    }

    if (message.type === "presence") {
      this.listeners.onPresence(message.topic, message.devices);
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.open();
    }, this.retryMs);

    this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
  }

  private teardown(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }

    this.socket = undefined;
  }

  private async open(): Promise<void> {
    if (this.stopped || this.socket) {
      return;
    }

    const deviceId = getDeviceId();

    if (!deviceId) {
      return;
    }

    this.setStatus("connecting");

    let grant: DeviceSyncGrantResponse;

    try {
      grant = await requestGrant(deviceId);
    } catch {
      this.setStatus("closed");
      this.scheduleReconnect();

      return;
    }

    if (this.stopped) {
      return;
    }

    const url = new URL(grant.socketUrl);

    url.searchParams.set("grant", grant.token);
    url.searchParams.set("device_id", deviceId);

    const socket = new WebSocket(url.toString());

    this.socket = socket;

    socket.addEventListener("open", () => {
      this.retryMs = INITIAL_RETRY_MS;
      this.setStatus("open");
      this.resubscribe();
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_INTERVAL_MS);
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      try {
        const parsed = deviceSyncServerMessageSchema.safeParse(JSON.parse(event.data));

        if (parsed.success) {
          this.handle(parsed.data);
        }
      } catch {
        return;
      }
    });

    socket.addEventListener("close", () => {
      this.teardown();
      this.setStatus("closed");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      try {
        socket.close();
      } catch {
        return;
      }
    });
  }

  public start(): void {
    if (!this.stopped) {
      return;
    }

    this.stopped = false;
    void this.open();
  }

  public stop(): void {
    this.stopped = true;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }

    const socket = this.socket;

    this.teardown();

    try {
      socket?.close();
    } catch {
      return;
    }

    this.setStatus("idle");
  }

  public subscribe(topics: string[]): void {
    const added = topics.filter((topic) => !this.topics.has(topic));

    for (const topic of topics) {
      this.topics.add(topic);
    }

    if (added.length > 0) {
      this.send({
        type: "subscribe",
        topics: added.map((topic) => ({ topic, lastSeq: this.cursors.get(topic) ?? 0 })),
      });
    }
  }

  public hasTopic(topic: string): boolean {
    return this.topics.has(topic);
  }

  public unsubscribe(topics: string[]): void {
    const removed = topics.filter((topic) => this.topics.has(topic));

    for (const topic of removed) {
      this.topics.delete(topic);
    }

    if (removed.length > 0) {
      this.send({ type: "unsubscribe", topics: removed });
    }
  }

  public focus(topic: string | null): void {
    this.focusedTopic = topic;
    this.send({ type: "focus", topic });
  }

  public isOpen(): boolean {
    return this.status === "open";
  }
}

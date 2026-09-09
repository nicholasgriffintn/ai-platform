import {
  DEVICE_SYNC_EVENT_RETENTION_LIMIT,
  DEVICE_SYNC_MAX_TOPICS_PER_CONNECTION,
  DEVICE_SYNC_PROTOCOL_VERSION,
  deviceSyncClientMessageSchema,
  deviceSyncPublishBatchSchema,
  type DeviceSyncEvent,
  type DeviceSyncPresenceEntry,
  type DeviceSyncServerMessage,
} from "@ngriffin_uk/polychat-schemas";
import { Agent } from "agents";

import { TopicEventBus } from "~/lib/durable-objects/event-bus";
import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";

interface ConnectionState {
  deviceId: string;
  userId: number;
  topics: string[];
  focusedTopic: string | null;
  connectedAt: string;
}

type EventPayload = Omit<DeviceSyncEvent, "seq" | "at" | "topic">;

const PRESENCE_TOPIC_KINDS = new Set(["conversation", "project", "workspace"]);

export class UserSyncCoordinator extends Agent<IEnv> {
  private bus: TopicEventBus<EventPayload> | undefined;

  private get events(): TopicEventBus<EventPayload> {
    this.bus ??= new TopicEventBus<EventPayload>(this.ctx.storage, "device_sync", {
      retentionLimit: DEVICE_SYNC_EVENT_RETENTION_LIMIT,
    });

    return this.bus;
  }

  private readState(socket: WebSocket): ConnectionState | null {
    const raw = socket.deserializeAttachment();

    return raw && typeof raw === "object" ? (raw as ConnectionState) : null;
  }

  private writeState(socket: WebSocket, state: ConnectionState): void {
    socket.serializeAttachment(state);
  }

  private send(socket: WebSocket, message: DeviceSyncServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      try {
        socket.close(1011, "Sync send failed");
      } catch {
        return;
      }
    }
  }

  private subscribers(topic: string): { socket: WebSocket; state: ConnectionState }[] {
    const result: { socket: WebSocket; state: ConnectionState }[] = [];

    for (const socket of this.ctx.getWebSockets()) {
      const state = this.readState(socket);

      if (state?.topics.includes(topic)) {
        result.push({ socket, state });
      }
    }

    return result;
  }

  private presenceFor(topic: string): DeviceSyncPresenceEntry[] {
    return this.subscribers(topic).map(({ state }) => ({
      deviceId: state.deviceId,
      focusedTopic: state.focusedTopic,
      connectedAt: state.connectedAt,
    }));
  }

  private broadcastPresence(topic: string): void {
    const kind = topic.slice(0, topic.indexOf(":"));

    if (!PRESENCE_TOPIC_KINDS.has(kind)) {
      return;
    }

    const devices = this.presenceFor(topic);

    for (const { socket } of this.subscribers(topic)) {
      this.send(socket, { type: "presence", topic, devices });
    }
  }

  private deliver(event: DeviceSyncEvent): void {
    for (const { socket, state } of this.subscribers(event.topic)) {
      if (event.originDeviceId && event.originDeviceId === state.deviceId) {
        continue;
      }

      this.send(socket, { type: "event", event });
    }
  }

  private attachTopics(
    socket: WebSocket,
    state: ConnectionState,
    requested: { topic: string; lastSeq: number }[],
  ): void {
    const topics = new Set(state.topics);

    for (const { topic, lastSeq } of requested) {
      if (topics.size >= DEVICE_SYNC_MAX_TOPICS_PER_CONNECTION && !topics.has(topic)) {
        this.send(socket, { type: "reset", topic, seq: 0, reason: "overflow" });
        continue;
      }

      topics.add(topic);

      const replay = this.events.read(topic, lastSeq);

      if (replay.resetRequired) {
        this.send(socket, {
          type: "reset",
          topic,
          seq: replay.latestSeq,
          reason: lastSeq > replay.latestSeq ? "gap" : "retention",
        });
      } else {
        for (const stored of replay.events) {
          this.send(socket, {
            type: "event",
            event: { ...stored.payload, topic, seq: stored.seq, at: stored.at },
          });
        }
      }

      this.send(socket, { type: "subscribed", topic, seq: replay.latestSeq });
    }

    this.writeState(socket, { ...state, topics: [...topics] });

    for (const { topic } of requested) {
      this.broadcastPresence(topic);
    }
  }

  public override async webSocketMessage(
    socket: WebSocket,
    raw: string | ArrayBuffer,
  ): Promise<void> {
    const state = this.readState(socket);

    if (!state) {
      socket.close(1008, "Sync connection is not initialised");

      return;
    }

    const parsed = deviceSyncClientMessageSchema.safeParse(
      safeParseJson<unknown>(typeof raw === "string" ? raw : new TextDecoder().decode(raw)),
    );

    if (!parsed.success) {
      return;
    }

    const message = parsed.data;

    if (message.type === "ping") {
      this.send(socket, { type: "pong" });

      return;
    }

    if (message.type === "subscribe") {
      this.attachTopics(socket, state, message.topics);

      return;
    }

    if (message.type === "unsubscribe") {
      const removed = new Set(message.topics);

      this.writeState(socket, {
        ...state,
        topics: state.topics.filter((topic) => !removed.has(topic)),
      });

      for (const topic of removed) {
        this.broadcastPresence(topic);
      }

      return;
    }

    this.writeState(socket, { ...state, focusedTopic: message.topic });

    if (message.topic) {
      this.broadcastPresence(message.topic);
    }
  }

  public override async webSocketClose(socket: WebSocket): Promise<void> {
    this.releaseSocket(socket);
  }

  public override async webSocketError(socket: WebSocket): Promise<void> {
    this.releaseSocket(socket);
  }

  private releaseSocket(socket: WebSocket): void {
    const state = this.readState(socket);

    if (!state) {
      return;
    }

    for (const topic of state.topics) {
      this.broadcastPresence(topic);
    }
  }

  public override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const isUpgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";

    if (url.pathname === "/connect" && isUpgrade) {
      const deviceId = url.searchParams.get("deviceId");
      const userId = Number(url.searchParams.get("userId"));

      if (!deviceId || !Number.isInteger(userId) || userId <= 0) {
        return Response.json({ error: "Invalid sync connection" }, { status: 400 });
      }

      const pair = new WebSocketPair();

      this.ctx.acceptWebSocket(pair[1]);
      this.writeState(pair[1], {
        deviceId,
        userId,
        topics: [],
        focusedTopic: null,
        connectedAt: new Date().toISOString(),
      });
      this.send(pair[1], {
        type: "ready",
        deviceId,
        protocolVersion: DEVICE_SYNC_PROTOCOL_VERSION,
        at: new Date().toISOString(),
      });

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/publish" && request.method === "POST") {
      const parsed = deviceSyncPublishBatchSchema.safeParse(await request.json().catch(() => null));

      if (!parsed.success) {
        return Response.json({ error: "Invalid sync event batch" }, { status: 400 });
      }

      const sequences = parsed.data.events.map(({ topic, type, data, originDeviceId }) => {
        const appended = this.events.append(topic, {
          v: DEVICE_SYNC_PROTOCOL_VERSION,
          type,
          data,
          originDeviceId: originDeviceId ?? null,
        });

        this.deliver({
          ...appended.event.payload,
          topic,
          seq: appended.event.seq,
          at: appended.event.at,
        });

        return appended.event.seq;
      });

      return Response.json({ sequences });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

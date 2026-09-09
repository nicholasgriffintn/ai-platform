import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

vi.mock("agents", () => ({
  Agent: class {
    public ctx: DurableObjectState;
    public env: IEnv;

    constructor(ctx: DurableObjectState, env: IEnv) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const { UserSyncCoordinator } = await import("../coordinator/object");

interface FakeSocket {
  sent: unknown[];
  attachment: unknown;
  send: (payload: string) => void;
  close: () => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
}

function createSocket(): FakeSocket {
  const socket: FakeSocket = {
    sent: [],
    attachment: null,
    send: (payload) => socket.sent.push(JSON.parse(payload)),
    close: () => undefined,
    serializeAttachment: (value) => {
      socket.attachment = value;
    },
    deserializeAttachment: () => socket.attachment,
  };

  return socket;
}

function createCoordinator() {
  const sockets: FakeSocket[] = [];
  const rows: { topic: string; seq: number; at: string; payload: string }[] = [];
  const sql = {
    exec<T>(query: string, ...bindings: unknown[]) {
      if (query.startsWith("CREATE TABLE")) {
        return { one: () => ({}) as T, toArray: () => [] as T[] };
      }

      if (query.includes("MAX(seq)") || query.includes("MIN(seq)")) {
        const matching = rows.filter((row) => row.topic === bindings[0]);
        const seq = matching.length
          ? query.includes("MAX(seq)")
            ? Math.max(...matching.map((row) => row.seq))
            : Math.min(...matching.map((row) => row.seq))
          : null;

        return { one: () => ({ seq }) as T, toArray: () => [] as T[] };
      }

      if (query.startsWith("INSERT INTO")) {
        rows.push({
          topic: bindings[0] as string,
          seq: bindings[1] as number,
          at: bindings[2] as string,
          payload: bindings[3] as string,
        });

        return { one: () => ({}) as T, toArray: () => [] as T[] };
      }

      if (query.startsWith("DELETE FROM")) {
        return { one: () => ({}) as T, toArray: () => [] as T[] };
      }

      return {
        one: () => ({}) as T,
        toArray: () =>
          rows
            .filter((row) => row.topic === bindings[0] && row.seq > (bindings[1] as number))
            .sort((left, right) => left.seq - right.seq) as T[],
      };
    },
  };
  const ctx = {
    storage: { sql },
    acceptWebSocket: (socket: FakeSocket) => sockets.push(socket),
    getWebSockets: () => sockets,
  } as unknown as DurableObjectState;

  return {
    sockets,
    coordinator: new UserSyncCoordinator(ctx, {} as IEnv),
  };
}

async function connect(coordinator: InstanceType<typeof UserSyncCoordinator>, deviceId: string) {
  await coordinator
    .fetch(
      new Request(`https://user-sync-coordinator/connect?deviceId=${deviceId}&userId=1`, {
        headers: { Upgrade: "websocket" },
      }),
    )
    .catch(() => undefined);
}

async function publish(
  coordinator: InstanceType<typeof UserSyncCoordinator>,
  events: Record<string, unknown>[],
) {
  return coordinator.fetch(
    new Request("https://user-sync-coordinator/publish", {
      method: "POST",
      body: JSON.stringify({ events }),
    }),
  );
}

function messagesOfType(socket: FakeSocket, type: string): Record<string, unknown>[] {
  return socket.sent.filter(
    (message): message is Record<string, unknown> =>
      typeof message === "object" &&
      message !== null &&
      (message as { type: string }).type === type,
  );
}

describe("UserSyncCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "WebSocketPair",
      class {
        0 = createSocket();
        1 = createSocket();
      },
    );
  });

  it("delivers a published event to a subscribed device", async () => {
    const { coordinator, sockets } = createCoordinator();

    await connect(coordinator, "device-a");
    await coordinator.webSocketMessage(
      sockets[0] as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", topics: [{ topic: "user:1", lastSeq: 0 }] }),
    );
    await publish(coordinator, [{ topic: "user:1", type: "conversation.changed", data: {} }]);
    await vi.advanceTimersByTimeAsync(100);

    expect(messagesOfType(sockets[0], "event")).toHaveLength(1);
  });

  it("does not echo an event back to the device that caused it", async () => {
    const { coordinator, sockets } = createCoordinator();

    await connect(coordinator, "device-a");
    await coordinator.webSocketMessage(
      sockets[0] as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", topics: [{ topic: "user:1", lastSeq: 0 }] }),
    );
    await publish(coordinator, [
      { topic: "user:1", type: "conversation.changed", data: {}, originDeviceId: "device-a" },
    ]);
    await vi.advanceTimersByTimeAsync(100);

    expect(messagesOfType(sockets[0], "event")).toHaveLength(0);
  });

  it("delivers nothing for a topic no event was addressed to", async () => {
    const { coordinator, sockets } = createCoordinator();

    await connect(coordinator, "device-a");
    await coordinator.webSocketMessage(
      sockets[0] as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", topics: [{ topic: "conversation:x", lastSeq: 0 }] }),
    );
    await publish(coordinator, [{ topic: "conversation:y", type: "run.changed", data: {} }]);
    await vi.advanceTimersByTimeAsync(100);

    expect(messagesOfType(sockets[0], "event")).toHaveLength(0);
  });

  it("replays missed events when a device resubscribes from its cursor", async () => {
    const { coordinator, sockets } = createCoordinator();

    await connect(coordinator, "device-a");
    await publish(coordinator, [
      { topic: "user:1", type: "conversation.changed", data: { n: 1 } },
      { topic: "user:1", type: "conversation.changed", data: { n: 2 } },
    ]);
    await coordinator.webSocketMessage(
      sockets[0] as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", topics: [{ topic: "user:1", lastSeq: 1 }] }),
    );

    const events = messagesOfType(sockets[0], "event");

    expect(events).toHaveLength(1);
    expect((events[0].event as { seq: number }).seq).toBe(2);
  });

  it("asks a device ahead of the log to reset", async () => {
    const { coordinator, sockets } = createCoordinator();

    await connect(coordinator, "device-a");
    await publish(coordinator, [{ topic: "user:1", type: "conversation.changed", data: {} }]);
    await coordinator.webSocketMessage(
      sockets[0] as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", topics: [{ topic: "user:1", lastSeq: 9 }] }),
    );

    expect(messagesOfType(sockets[0], "reset")[0]?.reason).toBe("gap");
  });

  it("stops delivering after a device unsubscribes", async () => {
    const { coordinator, sockets } = createCoordinator();

    await connect(coordinator, "device-a");
    await coordinator.webSocketMessage(
      sockets[0] as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", topics: [{ topic: "user:1", lastSeq: 0 }] }),
    );
    await coordinator.webSocketMessage(
      sockets[0] as unknown as WebSocket,
      JSON.stringify({ type: "unsubscribe", topics: ["user:1"] }),
    );
    await publish(coordinator, [{ topic: "user:1", type: "conversation.changed", data: {} }]);
    await vi.advanceTimersByTimeAsync(100);

    expect(messagesOfType(sockets[0], "event")).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";

import { TopicEventBus } from "../event-bus";

interface Row {
  topic: string;
  seq: number;
  at: string;
  payload: string;
}

function createSqlStorage() {
  const rows: Row[] = [];

  return {
    rows,
    exec<T>(query: string, ...bindings: unknown[]) {
      if (query.startsWith("CREATE TABLE")) {
        return { one: () => ({}) as T, toArray: () => [] as T[] };
      }

      if (query.includes("MAX(seq)")) {
        const topic = bindings[0] as string;
        const matching = rows.filter((row) => row.topic === topic);

        return {
          one: () =>
            ({ seq: matching.length ? Math.max(...matching.map((row) => row.seq)) : null }) as T,
          toArray: () => [] as T[],
        };
      }

      if (query.includes("MIN(seq)")) {
        const topic = bindings[0] as string;
        const matching = rows.filter((row) => row.topic === topic);

        return {
          one: () =>
            ({ seq: matching.length ? Math.min(...matching.map((row) => row.seq)) : null }) as T,
          toArray: () => [] as T[],
        };
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

      if (query.startsWith("DELETE FROM") && query.includes("seq <=")) {
        const topic = bindings[0] as string;
        const threshold = bindings[1] as number;

        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].topic === topic && rows[index].seq <= threshold) {
            rows.splice(index, 1);
          }
        }

        return { one: () => ({}) as T, toArray: () => [] as T[] };
      }

      if (query.startsWith("DELETE FROM")) {
        const topic = bindings[0] as string;

        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].topic === topic) {
            rows.splice(index, 1);
          }
        }

        return { one: () => ({}) as T, toArray: () => [] as T[] };
      }

      const topic = bindings[0] as string;
      const after = bindings[1] as number;
      const limit = bindings[2] as number;

      return {
        one: () => ({}) as T,
        toArray: () =>
          rows
            .filter((row) => row.topic === topic && row.seq > after)
            .sort((left, right) => left.seq - right.seq)
            .slice(0, limit) as T[],
      };
    },
  };
}

function createBus(retentionLimit = 500) {
  const sql = createSqlStorage();
  const storage = { sql } as unknown as DurableObjectStorage;

  return {
    sql,
    bus: new TopicEventBus<{ value: number }>(storage, "device_sync", { retentionLimit }),
  };
}

describe("TopicEventBus", () => {
  it("assigns per-topic sequences independently", () => {
    const { bus } = createBus();

    expect(bus.append("user:1", { value: 1 }).event.seq).toBe(1);
    expect(bus.append("user:1", { value: 2 }).event.seq).toBe(2);
    expect(bus.append("conversation:a", { value: 3 }).event.seq).toBe(1);
  });

  it("replays only events after the supplied cursor", () => {
    const { bus } = createBus();

    bus.append("user:1", { value: 1 });
    bus.append("user:1", { value: 2 });
    bus.append("user:1", { value: 3 });

    const replay = bus.read("user:1", 1);

    expect(replay.resetRequired).toBe(false);
    expect(replay.events.map((event) => event.payload.value)).toEqual([2, 3]);
    expect(replay.latestSeq).toBe(3);
  });

  it("requires a reset when the cursor is ahead of the log", () => {
    const { bus } = createBus();

    bus.append("user:1", { value: 1 });

    expect(bus.read("user:1", 5).resetRequired).toBe(true);
  });

  it("requires a reset when retention has dropped the requested window", () => {
    const { bus } = createBus(2);

    bus.append("user:1", { value: 1 });
    bus.append("user:1", { value: 2 });
    bus.append("user:1", { value: 3 });
    bus.append("user:1", { value: 4 });

    expect(bus.read("user:1", 0).resetRequired).toBe(true);
    expect(bus.read("user:1", 3).resetRequired).toBe(false);
  });

  it("refuses an unsafe scope", () => {
    const storage = { sql: createSqlStorage() } as unknown as DurableObjectStorage;

    expect(() => new TopicEventBus(storage, "bad-scope; DROP", { retentionLimit: 10 })).toThrow();
  });
});

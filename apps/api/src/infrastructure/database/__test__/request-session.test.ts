import type { D1Database } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vitest";

import { createRequestDatabase } from "../request-session";

describe("createRequestDatabase", () => {
  it("routes queries through a primary-anchored session and keeps admin calls on the binding", async () => {
    const session = { prepare: vi.fn(() => "statement"), batch: vi.fn(async () => []) };
    const database = {
      withSession: vi.fn(() => session),
      prepare: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(async () => ({ count: 0, duration: 0 })),
      dump: vi.fn(),
    };

    const requestDatabase = createRequestDatabase(database as unknown as D1Database);

    requestDatabase.prepare("SELECT 1");
    await requestDatabase.batch([]);
    await requestDatabase.exec("PRAGMA optimize");

    expect(database.withSession).toHaveBeenCalledWith("first-primary");
    expect(session.prepare).toHaveBeenCalledWith("SELECT 1");
    expect(session.batch).toHaveBeenCalledOnce();
    expect(database.prepare).not.toHaveBeenCalled();
    expect(database.exec).toHaveBeenCalledWith("PRAGMA optimize");
  });
});

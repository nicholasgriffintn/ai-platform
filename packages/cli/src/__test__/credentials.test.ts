import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCredential, saveCredential } from "../credentials.js";

describe("saveCredential", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "polychat-credentials-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("keeps every server when logins run at the same time", async () => {
    const path = join(directory, "credentials.json");
    const servers = Array.from({ length: 8 }, (_, index) => `https://server-${index}.test`);
    const credential = {
      apiKey: "key",
      clientName: "Polychat CLI",
      createdAt: "2026-11-07T00:00:00.000Z",
    };

    await Promise.all(servers.map((server) => saveCredential(path, server, credential)));

    const saved = await Promise.all(servers.map((server) => readCredential(path, server)));

    expect(saved.every(Boolean)).toBe(true);
  });
});

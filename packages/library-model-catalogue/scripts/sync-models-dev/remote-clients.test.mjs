import { afterEach, describe, expect, it, vi } from "vitest";

import { parseArgs } from "./cli.mjs";
import { triggerArtificialAnalysisIngest } from "./remote-clients.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Artificial Analysis ingest trigger", () => {
  it("is requested from the command line", () => {
    expect(parseArgs(["--write", "--trigger-analysis-task"]).triggerAnalysisTask).toBe(true);
    expect(parseArgs(["--write"]).triggerAnalysisTask).toBe(false);
  });

  it("queues the ingest on the admin endpoint and fails loudly when refused", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ task_id: "task-1" }))
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      triggerArtificialAnalysisIngest({
        apiUrl: "https://api.polychat.app",
        apiKey: "key",
        write: true,
        stats: {},
      }),
    ).resolves.toBe("task-1");

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("https://api.polychat.app/admin/model-analysis/sync-completed");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer key");

    await expect(
      triggerArtificialAnalysisIngest({
        apiUrl: "https://api.polychat.app",
        apiKey: "key",
        write: true,
        stats: {},
      }),
    ).rejects.toThrow("403");
  });
});

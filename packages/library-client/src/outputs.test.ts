import { afterEach, describe, expect, it, vi } from "vitest";

import { getOutputHistory, restoreOutputRevision } from "./outputs";

describe("output revision api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads authorised revision history", async () => {
    const history = { current: { revision: 3 }, revisions: [], restore: { supported: true } };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(history),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(getOutputHistory("output/1")).resolves.toEqual(history);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/outputs/output%2F1/revisions");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
  });

  it("sends the current revision fence when restoring", async () => {
    const restored = { id: "output-1", revision: 4 };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(restored),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(restoreOutputRevision("output-1", 2, 3)).resolves.toEqual(restored);
    const [input, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(input)).toContain("/outputs/output-1/revisions/2/restore");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toEqual({ expectedRevision: 3 });
  });
});

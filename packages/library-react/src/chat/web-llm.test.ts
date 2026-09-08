import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ create: vi.fn(), unload: vi.fn(), complete: vi.fn() }));

vi.mock("@mlc-ai/web-llm", () => ({ CreateMLCEngine: sdk.create }));

import { WebLLMService } from "./web-llm.js";

const service = WebLLMService.getInstance();

afterEach(async () => {
  await service.unload();
  vi.resetAllMocks();
});

describe("browser model lifecycle", () => {
  it("shares overlapping model initialisation and waits before replacing the engine", async () => {
    let release = () => {};

    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });

    sdk.create.mockImplementation(async () => {
      await ready;

      return { unload: sdk.unload, chat: { completions: { create: sdk.complete } } };
    });
    const first = service.init("first");
    const duplicate = service.init("first");
    const next = service.init("second");

    await vi.waitFor(() => expect(sdk.create).toHaveBeenCalledTimes(1));
    expect(sdk.unload).not.toHaveBeenCalled();
    release();
    await Promise.all([first, duplicate, next]);
    expect(sdk.create.mock.calls.map(([model]) => model)).toEqual(["first", "second"]);
    expect(sdk.unload).toHaveBeenCalledTimes(1);
    expect(service.getCurrentModel()).toBe("second");
  });

  it("keeps a streaming engine alive and sends only the supplied conversation history", async () => {
    let release = () => {};

    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });

    sdk.create.mockResolvedValue({
      unload: sdk.unload,
      chat: { completions: { create: sdk.complete } },
    });
    sdk.complete.mockImplementation(async function* () {
      yield { choices: [{ delta: { content: "Hello" } }] };
      await ready;
      yield { choices: [{ delta: { content: "!" }, finish_reason: "length" }] };
    });
    const progress = vi.fn();
    const first = service.generate("first", [{ role: "user", content: "Private chat" }], progress);
    const switched = service.init("second");

    await vi.waitFor(() => expect(progress).toHaveBeenCalledWith("Hello"));
    expect(sdk.unload).not.toHaveBeenCalled();
    release();
    expect(await first).toBe("Hello!");
    await switched;
    await service.generate("second", [{ role: "user", content: "Different chat" }]);
    expect(sdk.complete.mock.calls[1][0].messages).toEqual([
      { role: "user", content: "Different chat" },
    ]);
    expect(sdk.create.mock.calls.map(([model]) => model)).toEqual(["first", "second"]);
  });

  it("can retry after initialisation fails", async () => {
    sdk.create.mockRejectedValueOnce(new Error("Download failed"));
    await expect(service.init("first")).rejects.toThrow("Download failed");
    sdk.create.mockResolvedValue({
      unload: sdk.unload,
      chat: { completions: { create: sdk.complete } },
    });
    await service.init("first");
    expect(service.getCurrentModel()).toBe("first");
  });
});

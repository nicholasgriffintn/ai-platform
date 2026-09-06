import { createFakeDesktopBackend } from "@ngriffin_uk/polychat-library-chat";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type { DesktopEndpoint } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { streamDeviceModelRun } from "./device-run";

const ollamaEndpoint = {
  id: "ollama-local",
  kind: "model",
  vendor: "ollama",
  label: "Ollama",
  url: "http://127.0.0.1:11434",
  transport: "loopback",
  pairingSecretStored: false,
  approvedAt: "2026-01-01T00:00:00Z",
  lastSeenAt: null,
} as DesktopEndpoint;

const model = {
  id: "ollama-gemma3-4b",
  matchingModel: "gemma3:4b",
  name: "Gemma 3 4B",
  provider: "ollama",
  runsOn: "device" as const,
};

const messages: Message[] = [
  { id: "message-1", role: "user", content: "How does a parrot moult?" },
];

describe("streamDeviceModelRun", () => {
  it("streams the runtime's text back and returns the whole reply", async () => {
    const backend = createFakeDesktopBackend({
      endpoints: [ollamaEndpoint],
      script: [
        { type: "text", runId: "run-1", delta: "Feathers " },
        { type: "text", runId: "run-1", delta: "drop in stages." },
        { type: "finished", runId: "run-1", reason: "complete", at: "2026-01-01T00:00:00Z" },
      ],
    });
    const renders: string[] = [];

    const text = await streamDeviceModelRun({
      backend,
      conversationId: "conversation-1",
      messages,
      model,
      onContent: (content: string) => renders.push(content),
      signal: new AbortController().signal,
    });

    expect(renders).toEqual(["Feathers ", "Feathers drop in stages."]);
    expect(text).toBe("Feathers drop in stages.");
  });

  it("refuses to run when no runtime for that vendor is connected", async () => {
    const backend = createFakeDesktopBackend({ endpoints: [] });

    await expect(
      streamDeviceModelRun({
        backend,
        conversationId: "conversation-1",
        messages,
        model,
        onContent: () => undefined,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/No ollama runtime is connected/);
  });

  it("surfaces a runtime failure instead of returning a partial reply", async () => {
    const backend = createFakeDesktopBackend({
      endpoints: [ollamaEndpoint],
      script: [
        { type: "text", runId: "run-1", delta: "Half a " },
        {
          type: "failed",
          runId: "run-1",
          failure: "model-not-found",
          message: "gemma3:4b is not pulled",
        },
      ],
    });

    await expect(
      streamDeviceModelRun({
        backend,
        conversationId: "conversation-1",
        messages,
        model,
        onContent: () => undefined,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("gemma3:4b is not pulled");
  });
});

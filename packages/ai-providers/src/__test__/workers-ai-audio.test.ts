import { describe, expect, it, vi } from "vitest";

import type { AudioSynthesisRequest } from "../capabilities/audio/index.js";
import { WorkersAiAudioProvider } from "../capabilities/audio/providers/WorkersAiAudioProvider.js";
import type { ProviderEnv, ProviderUser } from "../env.js";
import { createTestRuntime } from "./test-runtime.js";

const user: ProviderUser = { id: 1, email: "reader@example.com" };

function speak(overrides: Partial<AudioSynthesisRequest>) {
  const run = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  const provider = new WorkersAiAudioProvider(createTestRuntime());
  const env: ProviderEnv = Object.assign(Object.create(null), { AI: { run } });
  const result = provider.synthesize({
    input: "hello",
    model: "@cf/deepgram/aura-2-en",
    voice: "luna",
    env,
    user,
    ...overrides,
  });

  return { run, result };
}

describe("WorkersAiAudioProvider", () => {
  it("keeps the requested voice for regional English", async () => {
    const { run, result } = speak({ locale: "en-GB" });

    await result;

    expect(run).toHaveBeenCalledWith(
      "@cf/deepgram/aura-2-en",
      { text: "hello", speaker: "luna", encoding: "mp3" },
      expect.anything(),
    );
  });

  it("moves Spanish to the Spanish model and one of its voices", async () => {
    const { run, result } = speak({ locale: "es-MX" });

    await expect(result).resolves.toMatchObject({
      metadata: { model: "@cf/deepgram/aura-2-es", voice: "aquila" },
    });
    expect(run).toHaveBeenCalledWith(
      "@cf/deepgram/aura-2-es",
      { text: "hello", speaker: "aquila", encoding: "mp3" },
      expect.anything(),
    );
  });

  it("refuses a language Workers AI cannot voice", async () => {
    const { run, result } = speak({ locale: "fr" });

    await expect(result).rejects.toThrow('Workers AI has no voice for "fr"');
    expect(run).not.toHaveBeenCalled();
  });
});

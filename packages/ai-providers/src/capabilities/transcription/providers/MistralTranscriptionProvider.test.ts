import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRuntime } from "../../../__test__/test-runtime.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { MistralTranscriptionProvider } from "./MistralTranscriptionProvider.js";

const mocks = vi.hoisted(() => ({
  resolveProviderApiKey: vi.fn(),
}));

vi.mock("../../../credentials.js", () => ({
  hasHostUserProviderApiKey: vi.fn(),
  resolveHostProviderApiKey: mocks.resolveProviderApiKey,
}));

const env = { AI_GATEWAY_TOKEN: "gateway-token", ACCOUNT_ID: "account" } as ProviderEnv;
const user = { id: 42, plan_id: "pro" } as ProviderUser;
const audio = { kind: "file" as const, file: new Blob(["audio"], { type: "audio/wav" }) };

function sentForm(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>): FormData {
  const body = fetchMock.mock.calls[0]?.[1]?.body;

  if (!(body instanceof FormData)) {
    throw new Error("Expected a multipart transcription request");
  }

  return body;
}

describe("MistralTranscriptionProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    mocks.resolveProviderApiKey.mockResolvedValue("mistral-key");
    fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        text: "Hello there. Hi.",
        segments: [
          {
            type: "transcription_segment",
            text: "Hello there.",
            start: 0,
            end: 1.2,
            speaker_id: "speaker_1",
          },
          {
            type: "transcription_segment",
            text: "Hi.",
            start: 1.1,
            end: 1.6,
            speaker_id: "speaker_2",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests diarized Voxtral 3 segments and keeps speaker labels", async () => {
    const result = await new MistralTranscriptionProvider(createTestRuntime()).transcribe({
      env,
      user,
      audio,
      model: "voxtral-small-latest",
      timestamps: true,
      vocabulary: ["Polychat", "Voxtral"],
    });
    const form = sentForm(fetchMock);

    expect(form.get("model")).toBe("voxtral-small-transcribe-3-0");
    expect(form.get("timestamp_granularities")).toBe("segment");
    expect(form.get("diarize")).toBe("true");
    expect(form.has("language")).toBe(false);
    expect(form.getAll("context_bias")).toEqual(["Polychat", "Voxtral"]);
    expect(result.segments).toEqual([
      { start: 0, end: 1.2, text: "Hello there.", speaker: "speaker_1" },
      { start: 1.1, end: 1.6, text: "Hi.", speaker: "speaker_2" },
    ]);
  });

  it("defaults to Voxtral Mini Transcribe 3 and passes an explicit language", async () => {
    await new MistralTranscriptionProvider(createTestRuntime()).transcribe({
      env,
      user,
      audio,
      model: "whisper",
      language: "fr",
    });
    const form = sentForm(fetchMock);

    expect(form.get("model")).toBe("voxtral-mini-transcribe-3-0");
    expect(form.get("language")).toBe("fr");
    expect(form.has("diarize")).toBe(false);
  });
});

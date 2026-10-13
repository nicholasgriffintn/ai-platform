import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

const handleTranscribe = vi.hoisted(() => vi.fn());
const source = vi.hoisted(() => ({ file: new Blob(["video"], { type: "video/mp4" }) }));
const storeSourceFile = vi.hoisted(() =>
  vi.fn(async () => ({ url: "https://api.example/private/captioned.mp4", sourceId: "source-9" })),
);

vi.mock("../transcribe", () => ({ handleTranscribe }));
vi.mock("../transcription-input", () => ({
  resolveAuthorisedTranscriptionSource: async () => ({ kind: "file", file: source.file }),
}));
vi.mock("~/infrastructure/storage", () => ({
  StorageService: { forPrivateAssets: () => ({ storeSourceFile }) },
}));

import { burnCaptionsIntoVideo } from "../captioned-video";

const USER = { id: 8, plan_id: "pro" } as unknown as IUser;

function contextWith(fetch: (url: string, init: RequestInit) => Promise<Response>) {
  return { env: { SANDBOX_WORKER: { fetch: vi.fn(fetch) } } } as unknown as ServiceContext;
}

describe("burnCaptionsIntoVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    source.file = new Blob(["video"], { type: "video/mp4" });
  });

  it("sends timed captions without speaker labels and stores the encoded video", async () => {
    handleTranscribe.mockResolvedValue({
      status: "success",
      content: "Hello there.",
      words: [
        { word: "Hello", start: 0, end: 0.4, speaker: "0" },
        { word: "there.", start: 0.4, end: 0.9, speaker: "0" },
      ],
    });
    let sentCaptions = "";
    const context = contextWith(async (_url, init) => {
      sentCaptions = String((init.body as FormData).get("captions"));

      return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "video/mp4" } });
    });

    const result = await burnCaptionsIntoVideo({ context, user: USER, url: "https://api/v.mp4" });

    expect(handleTranscribe).toHaveBeenCalledWith(
      expect.objectContaining({ timestamps: true, allowVideo: true }),
    );
    expect(sentCaptions).toBe("1\n00:00:00,000 --> 00:00:00,900\nHello there.\n");
    expect(storeSourceFile).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "video/mp4", byteSize: 3 }),
    );
    expect(result).toEqual({
      videoUrl: "https://api.example/private/captioned.mp4",
      sourceId: "source-9",
      cueCount: 1,
    });
  });

  it("refuses audio files and transcripts without timings before encoding", async () => {
    const fetch = vi.fn();
    const context = contextWith(fetch);

    source.file = new Blob(["audio"], { type: "audio/mpeg" });
    await expect(
      burnCaptionsIntoVideo({ context, user: USER, url: "https://api/a.mp3" }),
    ).rejects.toBeInstanceOf(AssistantError);

    source.file = new Blob(["video"], { type: "video/mp4" });
    handleTranscribe.mockResolvedValue({ status: "success", content: "Untimed" });
    await expect(
      burnCaptionsIntoVideo({ context, user: USER, url: "https://api/v.mp4" }),
    ).rejects.toThrow("without timings");
    expect(fetch).not.toHaveBeenCalled();
  });
});

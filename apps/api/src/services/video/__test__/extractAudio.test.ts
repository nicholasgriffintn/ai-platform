import { describe, expect, it } from "vitest";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { VideoAudioExtractorFactory } from "../../video/extractAudio";

describe("VideoAudioExtractor", () => {
  const env = {} as IEnv;

  it("detects youtube and returns url as audio string", async () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const extractor = VideoAudioExtractorFactory.getDefault();
    const { audio, metadata } = await extractor.extractAudio(env, url);
    expect(typeof audio).toBe("string");
    expect(metadata.platform).toBe("youtube");
    expect(metadata.originalUrl).toBe(url);
  });

  it("validates url and throws on invalid", async () => {
    const extractor = VideoAudioExtractorFactory.getDefault();
    await expect(extractor.extractAudio(env, "notaurl")).rejects.toThrow(
      new AssistantError("Invalid URL provided", ErrorType.PARAMS_ERROR),
    );
  });
});
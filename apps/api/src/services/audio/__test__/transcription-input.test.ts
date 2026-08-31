import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import {
  assertValidTranscriptionFile,
  resolveAuthorisedTranscriptionSource,
} from "../transcription-input";

function webmBlob(type = "audio/webm"): Blob {
  return new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01])], { type });
}

describe("transcription input policy", () => {
  it("accepts an audio file only when its MIME type matches its container", async () => {
    await expect(assertValidTranscriptionFile(webmBlob())).resolves.toBeUndefined();

    await expect(assertValidTranscriptionFile(webmBlob("audio/mpeg"))).rejects.toMatchObject({
      statusCode: 415,
    });
  });

  it("enforces the actual blob size", async () => {
    await expect(assertValidTranscriptionFile(webmBlob(), { maxBytes: 4 })).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("rejects empty and unknown media", async () => {
    await expect(
      assertValidTranscriptionFile(new Blob([], { type: "audio/webm" })),
    ).rejects.toBeInstanceOf(AssistantError);
    await expect(
      assertValidTranscriptionFile(new Blob(["text"], { type: "text/plain" })),
    ).rejects.toMatchObject({ statusCode: 415 });
  });

  it("rejects all external URL transcription", async () => {
    await expect(
      resolveAuthorisedTranscriptionSource({
        context: { env: { API_BASE_URL: "https://api.polychat.test" } } as ServiceContext,
        url: "https://media.example/audio.webm",
        userId: 42,
      }),
    ).rejects.toThrow("Only authorised stored media can be transcribed by URL");
  });

  it("denies a private media resource owned by another user", async () => {
    const bucketGet = vi.fn();
    const context = {
      env: {
        API_BASE_URL: "https://api.polychat.test",
        PRIVATE_ASSETS_BUCKET: { get: bucketGet },
      },
      repositories: {
        sources: {
          getSource: vi.fn().mockResolvedValue({
            id: "source-1",
            storage_key: "private/source-1.webm",
            mime_type: "audio/webm",
            project_id: null,
            created_by_user_id: 7,
          }),
        },
      },
    } as unknown as ServiceContext;

    await expect(
      resolveAuthorisedTranscriptionSource({
        context,
        url: "https://api.polychat.test/sources/source-1/content",
        userId: 42,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(bucketGet).not.toHaveBeenCalled();
  });
});

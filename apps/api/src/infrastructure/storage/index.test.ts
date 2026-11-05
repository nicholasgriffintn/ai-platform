import { readMediaProvenance } from "@ngriffin_uk/polychat-utility-server/media-provenance";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { StorageService } from ".";

describe("StorageService output persistence", () => {
  it("stores generated media with its mark and records the marked size", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const createOutput = vi.fn(async (record: { id: string }) => ({ id: record.id }));
    const context = {
      env: {},
      repositories: fakeRepositories([
        [WorkspaceRepository, { getProject: vi.fn() }],
        [OutputRepository, { createOutput }],
      ]),
    } as unknown as ServiceContext;
    const storage = new StorageService({ put } as never, context, context.env);
    const audio = Uint8Array.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]);

    await storage.storeOutputFile({
      key: "generations/audio.mp3",
      data: audio,
      mimeType: "audio/mpeg",
      byteSize: audio.byteLength,
      createdByUserId: 7,
      capabilityId: "speech",
      kind: "generated_media",
      title: "audio.mp3",
      provenance: { model: "acme/voice", mimeType: "audio/mpeg" },
    });

    const [, stored] = put.mock.calls.find(([key]) => key === "generations/audio.mp3") ?? [];

    expect(readMediaProvenance(stored)?.model).toBe("acme/voice");
    expect(createOutput).toHaveBeenCalledWith(
      expect.objectContaining({ byteSize: stored.byteLength }),
    );
  });

  it("keeps R2 content when the Output commit succeeded before its follow-up read failed", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const context = {
      env: {},
      repositories: fakeRepositories([
        [WorkspaceRepository, { getProject: vi.fn() }],
        [
          OutputRepository,
          {
            createOutput: vi.fn().mockRejectedValue(new Error("follow-up read failed")),
            getOutputIncludingDeleting: vi.fn().mockResolvedValue({
              id: "output-1",
              created_by_user_id: 42,
              storage_key: "private/users/42/output-1.json",
            }),
          },
        ],
      ]),
    } as unknown as ServiceContext;
    const storage = new StorageService(
      { put, delete: deleteObject } as never,
      context,
      context.env,
    );

    await expect(
      storage.storeOutputFile({
        outputId: "output-1",
        key: "private/users/42/output-1.json",
        data: "{}",
        mimeType: "application/json",
        createdByUserId: 42,
        capabilityId: "ocr",
        kind: "ocr_result",
        title: "OCR result",
      }),
    ).resolves.toEqual({
      outputId: "output-1",
      key: "private/users/42/output-1.json",
      url: "/outputs/output-1/content",
    });
    expect(put).toHaveBeenCalledOnce();
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

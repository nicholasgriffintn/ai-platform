import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { StorageService } from ".";

describe("StorageService output persistence", () => {
  it("keeps R2 content when the Output commit succeeded before its follow-up read failed", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const context = {
      env: {},
      repositories: {
        workspaces: { getProject: vi.fn() },
        outputs: {
          createOutput: vi.fn().mockRejectedValue(new Error("follow-up read failed")),
          getOutputIncludingDeleting: vi.fn().mockResolvedValue({
            id: "output-1",
            created_by_user_id: 42,
            storage_key: "private/users/42/output-1.json",
          }),
        },
      },
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

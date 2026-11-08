import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { resolveOcrInput } from "./input";

const readPrivateFile = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/storage/read-resource", () => ({ readPrivateFile }));

const context = { env: {} } as ServiceContext;

describe("resolveOcrInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unsupported private formats and files over the OCR limits", async () => {
    readPrivateFile.mockResolvedValueOnce({
      record: {
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        created_by_user_id: 42,
      },
      object: { size: 1, arrayBuffer: vi.fn() },
    });
    await expect(
      resolveOcrInput({
        context,
        userId: 42,
        input: { type: "source", source_id: "source-1" },
      }),
    ).rejects.toThrow("PDF or a supported raster image");

    readPrivateFile.mockResolvedValueOnce({
      record: { mime_type: "application/pdf", created_by_user_id: 42 },
      object: { size: 25 * 1024 * 1024 + 1, arrayBuffer: vi.fn() },
    });
    await expect(
      resolveOcrInput({
        context,
        userId: 42,
        input: { type: "source", source_id: "source-1" },
      }),
    ).rejects.toThrow("25MB or smaller");
  });

  it("prevents private files from crossing personal and project scopes", async () => {
    readPrivateFile.mockResolvedValue({
      record: { mime_type: "application/pdf", project_id: "project-2" },
      object: { size: 1, arrayBuffer: vi.fn() },
    });

    await expect(
      resolveOcrInput({
        context,
        userId: 42,
        projectId: "project-1",
        input: { type: "source", source_id: "source-1" },
      }),
    ).rejects.toThrow("same project scope");
  });
});

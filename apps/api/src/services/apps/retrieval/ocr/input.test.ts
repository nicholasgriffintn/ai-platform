import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { resolveOcrInput } from "./input";

const readPrivateFile = vi.hoisted(() => vi.fn());

vi.mock("~/lib/storage/read-resource", () => ({ readPrivateFile }));

const context = { env: {} } as ServiceContext;

describe("resolveOcrInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes explicitly typed public inputs through", async () => {
    await expect(
      resolveOcrInput({
        context,
        userId: 42,
        input: { type: "document_url", document_url: "https://example.test/document.pdf" },
      }),
    ).resolves.toEqual({
      document: {
        type: "document_url",
        document_url: "https://example.test/document.pdf",
      },
    });
    expect(readPrivateFile).not.toHaveBeenCalled();
  });

  it("authorises and converts private PDF sources to provider-safe data URLs", async () => {
    readPrivateFile.mockResolvedValue({
      record: {
        mime_type: "application/pdf",
        filename: "scan.pdf",
        project_id: null,
        created_by_user_id: 42,
      },
      object: {
        size: 3,
        arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
      },
    });

    await expect(
      resolveOcrInput({
        context,
        userId: 42,
        input: { type: "source", source_id: "source-1" },
      }),
    ).resolves.toEqual({
      document: {
        type: "document_url",
        document_url: "data:application/pdf;base64,AQID",
        document_name: "scan.pdf",
      },
      sourceId: "source-1",
    });
    expect(readPrivateFile).toHaveBeenCalledWith({
      context,
      kind: "source",
      resourceId: "source-1",
      userId: 42,
    });
  });

  it("classifies private raster images from their authoritative MIME type", async () => {
    readPrivateFile.mockResolvedValue({
      record: {
        mime_type: "image/png",
        filename: "scan.png",
        project_id: null,
        created_by_user_id: 42,
      },
      object: {
        size: 1,
        arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1]).buffer),
      },
    });

    await expect(
      resolveOcrInput({
        context,
        userId: 42,
        input: { type: "output", output_id: "output-1" },
      }),
    ).resolves.toMatchObject({
      document: { type: "image_url", image_url: "data:image/png;base64,AQ==" },
      parentOutputId: "output-1",
    });
  });

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

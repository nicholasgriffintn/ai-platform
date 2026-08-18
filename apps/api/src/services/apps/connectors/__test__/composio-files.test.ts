import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ErrorType } from "~/utils/errors";

import {
  assertComposioFileBridgeAvailable,
  importComposioOperationFileResults,
  importComposioSessionFile,
  resolveComposioFileReferences,
  stageComposioResourceFile,
  type ComposioMountFileClient,
} from "../composio-files";
import {
  COMPOSIO_FILE_MAX_BYTES,
  readBoundedResponseBody,
  requireComposioMountPath,
  requireComposioPresignedUrl,
} from "../composio-files-security";

const sourceRecord = {
  id: "source-1",
  created_by_user_id: 42,
  project_id: null,
  conversation_id: null,
  connection_id: null,
  kind: "file",
  title: "Quarterly report",
  status: "available",
  content: null,
  provider: null,
  external_uri: null,
  vector_id: null,
  metadata: "{}",
  storage_key: "uploads/42/documents/report.pdf",
  mime_type: "application/pdf",
  filename: "report.pdf",
  byte_size: 4,
  created_at: "2026-08-13T10:00:00.000Z",
  updated_at: null,
};

function createContext(overrides: Record<string, unknown> = {}) {
  const put = vi.fn().mockResolvedValue(undefined);
  const createOutput = vi.fn().mockResolvedValue({ id: "output-1" });
  const context = {
    env: {
      PRIVATE_ASSETS_BUCKET: {
        get: vi.fn().mockResolvedValue({
          size: 4,
          arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
        }),
        put,
      },
      API_BASE_URL: "https://api.example.com",
    },
    repositories: {
      sources: { getSource: vi.fn().mockResolvedValue(sourceRecord) },
      outputs: {
        getOutput: vi.fn().mockResolvedValue(null),
        createOutput,
      },
    },
    requireUser: () => ({ id: 42, plan_id: "free" }),
    ...overrides,
  } as unknown as ServiceContext;

  return { context, put, createOutput };
}

function createMountClient(): ComposioMountFileClient {
  return {
    createUploadUrl: vi.fn(async ({ mountRelativePath }) => ({
      url: "https://composio-files.s3.amazonaws.com/upload?signature=secret",
      mountRelativePath,
      sandboxMountPrefix: "/mnt/files",
      expiresAt: "2026-08-13T10:05:00.000Z",
    })),
    createDownloadUrl: vi.fn(async ({ mountRelativePath }) => ({
      url: "https://composio-files.s3.amazonaws.com/download?signature=secret",
      mountRelativePath,
      sandboxMountPrefix: "/mnt/files",
      expiresAt: "2026-08-13T10:05:00.000Z",
    })),
  };
}

describe("Composio file bridge", () => {
  it("stages an owned Source in a session mount without exposing private storage keys", async () => {
    const { context } = createContext();
    const client = createMountClient();
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const result = await stageComposioResourceFile({
      context,
      userId: 42,
      client,
      fetcher,
      sessionId: "trs_123",
      resource: { kind: "source", id: "source-1" },
      mountRelativePath: "inputs/report.pdf",
    });

    expect(client.createUploadUrl).toHaveBeenCalledWith({
      sessionId: "trs_123",
      mountId: "files",
      mountRelativePath: "inputs/report.pdf",
      mimeType: "application/pdf",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://composio-files.s3.amazonaws.com/upload?signature=secret",
      expect.objectContaining({ method: "PUT", body: expect.any(ArrayBuffer) }),
    );
    expect(result).toEqual({
      mountRelativePath: "inputs/report.pdf",
      sandboxPath: "/mnt/files/inputs/report.pdf",
      mimeType: "application/pdf",
      filename: "report.pdf",
      byteSize: 4,
    });
    expect(JSON.stringify(result)).not.toContain("uploads/42");
    expect(JSON.stringify(result)).not.toContain("signature");
  });

  it("rejects resources owned by another user before reading private storage", async () => {
    const { context } = createContext();

    context.repositories.sources.getSource = vi
      .fn()
      .mockResolvedValue({ ...sourceRecord, created_by_user_id: 99 });

    await expect(
      stageComposioResourceFile({
        context,
        userId: 42,
        client: createMountClient(),
        sessionId: "trs_123",
        resource: { kind: "source", id: "source-1" },
      }),
    ).rejects.toMatchObject({ type: ErrorType.NOT_FOUND, statusCode: 404 });
    expect(context.env.PRIVATE_ASSETS_BUCKET.get).not.toHaveBeenCalled();
  });

  it("imports a bounded remote mount file as a personal Output", async () => {
    const { context, put, createOutput } = createContext();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([5, 6, 7]), {
        status: 200,
        headers: { "content-length": "3", "content-type": "application/pdf" },
      }),
    );

    const result = await importComposioSessionFile({
      context,
      userId: 42,
      client: createMountClient(),
      fetcher,
      sessionId: "trs_123",
      mountRelativePath: "reports/result.pdf",
      mimeType: "application/pdf",
    });

    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^composio\/outputs\/42\//),
      expect.any(ArrayBuffer),
      { httpMetadata: { contentType: "application/pdf" } },
    );
    expect(createOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByUserId: 42,
        projectId: null,
        capabilityId: "recipe-connectors",
        kind: "file",
        filename: "result.pdf",
        mimeType: "application/pdf",
        byteSize: 3,
      }),
    );
    expect(result).toEqual({ outputId: "output-1", filename: "result.pdf", byteSize: 3 });
  });

  it("resolves explicit Source and Output references recursively", async () => {
    const { context } = createContext();

    context.repositories.outputs.getOutput = vi.fn().mockResolvedValue({
      ...sourceRecord,
      id: "output-2",
      parent_output_id: null,
      capability_id: "notes",
      group_id: null,
      sensitivity: "personal",
      revision: 1,
    });
    const client = createMountClient();
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const resolved = await resolveComposioFileReferences({
      context,
      userId: 42,
      client,
      fetcher,
      sessionId: "trs_123",
      value: {
        attachments: [
          { $assistantFile: { kind: "source", id: "source-1" } },
          { $assistantFile: { kind: "output", id: "output-2", path: "draft/final.pdf" } },
        ],
      },
    });

    expect(resolved).toEqual({
      attachments: ["/mnt/files/report.pdf", "/mnt/files/draft/final.pdf"],
    });
  });

  it("imports only explicit Composio mount descriptors in operation results", async () => {
    const { context } = createContext();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([5, 6, 7]), {
        status: 200,
        headers: { "content-length": "3", "content-type": "application/pdf" },
      }),
    );

    const result = await importComposioOperationFileResults({
      context,
      userId: 42,
      client: createMountClient(),
      fetcher,
      sessionId: "trs_123",
      value: {
        report: {
          mount_relative_path: "reports/result.pdf",
          sandbox_mount_prefix: "/mnt/files",
          mimetype: "application/pdf",
          download_url: "https://composio-files.s3.amazonaws.com/do-not-return?secret=1",
        },
        publicLink: "https://example.com/report.pdf",
        message: "Written to /mnt/files/unsafe.pdf",
      },
    });

    expect(result).toEqual({
      report: {
        $assistantOutput: {
          id: "output-1",
          filename: "result.pdf",
          mimeType: "application/pdf",
          byteSize: 3,
        },
      },
      publicLink: "https://example.com/report.pdf",
      message: "Written to /mnt/files/unsafe.pdf",
    });
    expect(JSON.stringify(result)).not.toContain("download_url");
    expect(JSON.stringify(result)).not.toContain("secret=1");
  });

  it("rejects spoofed mount descriptors outside the files mount", async () => {
    const { context } = createContext();

    await expect(
      importComposioOperationFileResults({
        context,
        userId: 42,
        client: createMountClient(),
        sessionId: "trs_123",
        value: {
          mount_relative_path: "secrets.txt",
          sandbox_mount_prefix: "/etc",
          mimetype: "text/plain",
        },
      }),
    ).rejects.toMatchObject({ type: ErrorType.EXTERNAL_API_ERROR });
  });

  it("fails closed for file-shaped schemas when no bridge is available", () => {
    expect(() =>
      assertComposioFileBridgeAvailable({
        bridgeAvailable: false,
        inputSchema: {
          type: "object",
          properties: { attachment: { type: "string", format: "binary" } },
        },
      }),
    ).toThrowError(/file bridge is unavailable/i);
    expect(() =>
      assertComposioFileBridgeAvailable({
        bridgeAvailable: false,
        inputSchema: {
          type: "object",
          properties: { subject: { type: "string" } },
        },
      }),
    ).not.toThrow();
  });

  it("rejects traversal paths and non-S3 presigned origins", () => {
    expect(() => requireComposioMountPath("../secrets.txt")).toThrowError(/invalid/i);
    expect(() => requireComposioMountPath("safe/../../secrets.txt")).toThrowError(/invalid/i);
    expect(() => requireComposioPresignedUrl("http://bucket.s3.amazonaws.com/file")).toThrowError(
      /unsafe/i,
    );
    expect(() => requireComposioPresignedUrl("https://127.0.0.1/file")).toThrowError(/unsafe/i);
  });

  it("stops reading a response once it exceeds the file size limit", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(COMPOSIO_FILE_MAX_BYTES));
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      }),
    );

    await expect(readBoundedResponseBody(response)).rejects.toMatchObject({
      type: ErrorType.PARAMS_ERROR,
    });
  });
});

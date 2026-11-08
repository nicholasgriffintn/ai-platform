import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import {
  importComposioOperationFileResults,
  stageComposioResourceFile,
  type ComposioMountFileClient,
} from "../composio-files";
import { requireComposioMountPath, requireComposioPresignedUrl } from "../composio-files-security";

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
    repositories: fakeRepositories([
      [SourceRepository, { getSource: vi.fn().mockResolvedValue(sourceRecord) }],
      [
        OutputRepository,
        {
          getOutput: vi.fn().mockResolvedValue(null),
          createOutput,
        },
      ],
    ]),
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
  it("rejects resources owned by another user before reading private storage", async () => {
    const { context } = createContext();

    context.repositories.get(SourceRepository).getSource = vi
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

  it("rejects traversal paths and non-S3 presigned origins", () => {
    expect(() => requireComposioMountPath("../secrets.txt")).toThrowError(/invalid/i);
    expect(() => requireComposioMountPath("safe/../../secrets.txt")).toThrowError(/invalid/i);
    expect(() => requireComposioPresignedUrl("http://bucket.s3.amazonaws.com/file")).toThrowError(
      /unsafe/i,
    );
    expect(() => requireComposioPresignedUrl("https://127.0.0.1/file")).toThrowError(/unsafe/i);
  });
});

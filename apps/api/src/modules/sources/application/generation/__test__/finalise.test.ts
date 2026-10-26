import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { finaliseSourceGeneration } from "../finalise";

const fileKnowledgeSourceMock = vi.hoisted(() => vi.fn());

vi.mock("~/modules/knowledge/application/intake/file", () => ({
  fileKnowledgeSource: fileKnowledgeSourceMock,
}));
vi.mock("~/modules/sync/application/resource-events", () => ({
  publishResourceEvent: vi.fn(),
}));

const API = "https://api.test";

function sourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "source-1",
    created_by_user_id: 7,
    project_id: null,
    conversation_id: null,
    connection_id: null,
    kind: "file",
    title: "A lighthouse",
    status: "processing",
    content: null,
    provider: null,
    external_uri: null,
    vector_id: null,
    metadata: JSON.stringify({ generation: { type: "studio" }, pending: { asyncInvocation: {} } }),
    storage_key: null,
    mime_type: null,
    filename: null,
    byte_size: null,
    revision: 1,
    created_at: "2026-10-22T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

function setup({ failUpload = false } = {}) {
  const sources = new Map([["source-1", sourceRecord()]]);
  const objects = new Map<string, ArrayBuffer>([
    ["generations/a.png", new TextEncoder().encode("first").buffer],
    ["generations/b.png", new TextEncoder().encode("second").buffer],
  ]);
  const outputs = new Map([
    ["out-a", { id: "out-a", storage_key: "generations/a.png", mime_type: "image/png" }],
    ["out-b", { id: "out-b", storage_key: "generations/b.png", mime_type: "image/png" }],
  ]);
  const sourceRepository = {
    getSource: vi.fn(async (id: string) => sources.get(id) ?? null),
    updateSource: vi.fn(async (id: string, updates: Partial<SourceRecord>) => {
      const current = sources.get(id)!;

      sources.set(id, {
        ...current,
        ...updates,
        metadata: updates.metadata ? JSON.stringify(updates.metadata) : current.metadata,
      });
    }),
    attachSourceFile: vi.fn(
      async (id: string, file: { storageKey: string; mimeType: string }, updates = {}) => {
        sources.set(id, {
          ...sources.get(id)!,
          ...updates,
          storage_key: file.storageKey,
          mime_type: file.mimeType,
        });
      },
    ),
  };
  const outputRepository = {
    getOutput: vi.fn(async (id: string) =>
      outputs.has(id) ? { ...outputs.get(id), created_by_user_id: 7 } : null,
    ),
    deleteOutput: vi.fn(async (id: string) => {
      outputs.delete(id);
    }),
  };
  const bucket = {
    get: vi.fn(async (key: string) => {
      const data = objects.get(key);

      return data ? { arrayBuffer: async () => data } : null;
    }),
    put: vi.fn(async (key: string, data: ArrayBuffer) => {
      if (failUpload) {
        throw new Error("Bucket unavailable");
      }

      objects.set(key, data);
    }),
    delete: vi.fn(async (key: string) => {
      objects.delete(key);
    }),
  };

  fileKnowledgeSourceMock.mockImplementation(async () => {
    sources.set("source-2", sourceRecord({ id: "source-2" }));

    return { id: "source-2" };
  });

  const context = {
    env: { API_BASE_URL: API, PRIVATE_ASSETS_BUCKET: bucket },
    requireUser: () => ({ id: 7 }),
    repositories: fakeRepositories([
      [SourceRepository, sourceRepository],
      [OutputRepository, outputRepository],
    ]),
  } as unknown as ServiceContext;

  return { context, sources, objects, outputs };
}

const providerResponse = {
  response: [
    { type: "image_url", image_url: { url: `${API}/outputs/out-a/content` } },
    { type: "image_url", image_url: { url: `${API}/outputs/out-b/content` } },
  ],
};

describe("finaliseSourceGeneration", () => {
  beforeEach(() => {
    fileKnowledgeSourceMock.mockReset();
  });

  it("moves generated media into sources and only then removes the provider's copies", async () => {
    const { context, sources, objects, outputs } = setup();

    const stored = await finaliseSourceGeneration(
      context,
      sources.get("source-1")!,
      providerResponse,
    );

    expect(stored).toMatchObject({
      status: "available",
      storage_key: "sources/source-1/generation.png",
      mime_type: "image/png",
    });
    expect(JSON.parse(stored.metadata)).not.toHaveProperty("pending");
    expect(sources.get("source-2")).toMatchObject({
      status: "available",
      storage_key: "sources/source-2/generation.png",
    });
    expect([...objects.keys()].sort()).toEqual([
      "sources/source-1/generation.png",
      "sources/source-2/generation.png",
    ]);
    expect(outputs.size).toBe(0);
  });

  it("keeps the provider's copies and marks the source failed when saving fails", async () => {
    const { context, sources, objects, outputs } = setup({ failUpload: true });

    const stored = await finaliseSourceGeneration(
      context,
      sources.get("source-1")!,
      providerResponse,
    );

    expect(stored.status).toBe("failed");
    expect(JSON.parse(stored.metadata).generation.error).toBe("Bucket unavailable");
    expect(outputs.size).toBe(2);
    expect(objects.has("generations/a.png")).toBe(true);
  });
});

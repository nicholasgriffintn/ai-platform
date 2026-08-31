import { beforeEach, describe, expect, it, vi } from "vitest";

const insertEmbedding = vi.hoisted(() => vi.fn());
const deleteEmbedding = vi.hoisted(() => vi.fn());
const queryEmbeddings = vi.hoisted(() => vi.fn());

vi.mock("~/services/apps/embeddings/delete", () => ({ deleteEmbedding }));
vi.mock("~/services/apps/embeddings/insert", () => ({ insertEmbedding }));
vi.mock("~/services/apps/embeddings/query", () => ({ queryEmbeddings }));

import { generateNotesFromMedia } from "~/services/apps/notes/generate-from-media";
import { maybeVectorizeExtractedContent } from "~/services/apps/retrieval/lib/content-extract/vectorize";
import type { ContentExtractResult } from "~/services/apps/retrieval/types/content-extract";

import { create_note } from "../create_note";
import { get_note } from "../get_note";
import { search_documents } from "../search_documents";

const projectRequest = {
  env: {},
  user: { id: 42 },
  context: {},
  memoryScope: { type: "project", projectId: "project-1" },
} as any;

describe("unsupported project embedding paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects project document search before querying the personal index", async () => {
    await expect(
      search_documents.execute({ query: "project roadmap" }, { request: projectRequest } as any),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR", statusCode: 501 });

    expect(queryEmbeddings).not.toHaveBeenCalled();
  });

  it("rejects project note creation before inserting into the personal index", async () => {
    await expect(
      create_note.execute({ title: "Project note", content: "Project-only content" }, {
        request: projectRequest,
      } as any),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR", statusCode: 501 });

    expect(insertEmbedding).not.toHaveBeenCalled();
  });

  it("rejects project note retrieval before querying the personal index", async () => {
    await expect(
      get_note.execute({ query: "project note" }, { request: projectRequest } as any),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR", statusCode: 501 });

    expect(queryEmbeddings).not.toHaveBeenCalled();
  });

  it("refuses project content vectorisation before inserting into the personal index", async () => {
    const result: ContentExtractResult = {
      status: "success" as const,
      data: {
        extracted: {
          results: [{ url: "https://example.com", raw_content: "Project-only source" }],
          failed_results: [],
          response_time: 1,
        },
      },
    };

    await maybeVectorizeExtractedContent({
      params: { urls: "https://example.com", should_vectorize: true },
      req: projectRequest,
      provider: "cloudflare",
      extracted: result.data.extracted,
      result,
    });

    expect(result.data?.vectorized).toEqual({
      success: false,
      error: "Unable to store extracted content",
    });
    expect(insertEmbedding).not.toHaveBeenCalled();
  });

  it("rejects an oversized crawl result before storing any document", async () => {
    const extracted = {
      results: Array.from({ length: 11 }, (_, index) => ({
        url: `https://example.com/${index}`,
        raw_content: `Content ${index}`,
      })),
      failed_results: [],
      response_time: 1,
    };
    const result: ContentExtractResult = {
      status: "success",
      data: { extracted },
    };

    await maybeVectorizeExtractedContent({
      params: { urls: ["https://example.com"], should_vectorize: true },
      req: { ...projectRequest, memoryScope: { type: "personal" } },
      provider: "cloudflare",
      extracted,
      result,
    });

    expect(insertEmbedding).not.toHaveBeenCalled();
    expect(result.data?.vectorized).toEqual({
      success: false,
      error: "Unable to store extracted content",
    });
  });

  it("stores exactly the maximum of ten extracted documents", async () => {
    insertEmbedding.mockImplementation(async ({ request }) => ({
      status: "success",
      data: { id: request.id },
    }));
    const extracted = {
      results: Array.from({ length: 10 }, (_, index) => ({
        url: `https://example.com/${index}`,
        raw_content: `Content ${index}`,
      })),
      failed_results: [],
      response_time: 1,
    };
    const result: ContentExtractResult = {
      status: "success",
      data: { extracted },
    };

    await maybeVectorizeExtractedContent({
      params: { urls: ["https://example.com"], should_vectorize: true },
      req: { ...projectRequest, memoryScope: { type: "personal" } },
      provider: "cloudflare",
      extracted,
      result,
    });

    expect(insertEmbedding).toHaveBeenCalledTimes(10);
    expect(deleteEmbedding).not.toHaveBeenCalled();
    expect(result.data?.vectorized).toEqual({ success: true });
  });

  it.each([
    {
      cleanup: "succeeds",
      configureCleanup: () =>
        deleteEmbedding.mockResolvedValue({ status: "success", data: { ids: ["stored-1"] } }),
    },
    {
      cleanup: "fails",
      configureCleanup: () => deleteEmbedding.mockRejectedValue(new Error("cleanup unavailable")),
    },
  ])(
    "requests compensation for completed writes when a later write fails and cleanup $cleanup",
    async ({ configureCleanup }) => {
      insertEmbedding
        .mockResolvedValueOnce({ status: "success", data: { id: "stored-1" } })
        .mockRejectedValueOnce(new Error("private provider detail"));
      configureCleanup();
      const extracted = {
        results: [
          { url: "https://example.com/1", raw_content: "Content 1" },
          { url: "https://example.com/2", raw_content: "Content 2" },
        ],
        failed_results: [],
        response_time: 1,
      };
      const result: ContentExtractResult = {
        status: "success",
        data: { extracted },
      };
      const request = {
        ...projectRequest,
        memoryScope: { type: "personal" },
      };

      await maybeVectorizeExtractedContent({
        params: {
          urls: ["https://example.com/1", "https://example.com/2"],
          should_vectorize: true,
        },
        req: request,
        provider: "cloudflare",
        extracted,
        result,
      });

      expect(deleteEmbedding).toHaveBeenCalledWith({
        context: request.context,
        env: request.env,
        user: request.user,
        request: { ids: ["stored-1"] },
      });
      expect(result.data?.vectorized).toEqual({
        success: false,
        error: "Unable to store extracted content",
      });
      expect(JSON.stringify(result)).not.toContain("private provider detail");
      expect(JSON.stringify(result)).not.toContain("cleanup unavailable");
    },
  );

  it.each([undefined, "project-1"])(
    "rejects unsupported video search for personal and project requests",
    async (projectId) => {
      await expect(
        generateNotesFromMedia({
          env: {} as any,
          user: { id: 42 } as any,
          url: "https://example.com/video.mp4",
          outputs: ["concise_summary"],
          noteType: "general",
          enableVideoSearch: true,
          projectId,
        }),
      ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR", statusCode: 501 });

      expect(insertEmbedding).not.toHaveBeenCalled();
    },
  );
});

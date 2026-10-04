import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const createSource = vi.hoisted(() => vi.fn());
const requireProjectAccess = vi.hoisted(() => vi.fn());

vi.mock("~/modules/sources/application/sources", () => ({ createSource }));
vi.mock("~/modules/workspaces/application/access", () => ({ requireProjectAccess }));

import { sourceSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ContentExtractResult } from "~/modules/apps/application/ports/content-extract";
import { maybeStoreExtractedKnowledge } from "~/modules/apps/infrastructure/retrieval/content-extract/storage";
import { generateDocumentFromMedia } from "~/modules/documents/application";
import { get_note } from "~/modules/functions/application/get_note";
import { search_documents } from "~/modules/functions/application/search_documents";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import type { IRequest, IUser } from "~/types";

import { databaseTestEnvironment } from "./environment";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
const user: IUser = {
  id: 42,
  name: null,
  avatar_url: null,
  email: "test@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: null,
};
let request: IRequest;
const rollback = vi.spyOn(SourceRepository.prototype, "removeCreatedSources");
const savedSource = sourceSchema.parse({
  id: "saved",
  createdByUserId: 42,
  projectId: "project-1",
  conversationId: null,
  connectionId: null,
  kind: "url",
  title: "Example",
  status: "available",
  content: "Example",
  provider: null,
  externalUri: null,
  vectorId: null,
  metadata: {},
  file: null,
  createdAt: "2026-01-01",
  updatedAt: null,
});

beforeAll(async () => {
  const env = databaseTestEnvironment(await runtime.getD1Database("DB"));

  request = {
    env,
    user,
    context: createServiceContext({ env, user }),
    memoryScope: { type: "project", projectId: "project-1" },
  };
});
afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.clearAllMocks();
  createSource.mockReset();
  rollback.mockReset().mockResolvedValue(undefined);
  requireProjectAccess
    .mockReset()
    .mockRejectedValue(new AssistantError("Project access denied", ErrorType.FORBIDDEN, 403));
});

describe("native knowledge tools", () => {
  it.each([search_documents, get_note])(
    "rejects revoked project access before retrieval",
    async (tool) => {
      await expect(
        tool.execute({ query: "roadmap" }, { request, env: request.env, completionId: "test" }),
      ).rejects.toMatchObject({ statusCode: 403 });
    },
  );

  it("rejects oversized extracts before any source write", async () => {
    const extracted = {
      results: Array.from({ length: 11 }, (_, i) => ({
        url: `https://example.com/${i}`,
        raw_content: "Content",
      })),
      failed_results: [],
      response_time: 1,
    };
    const result: ContentExtractResult = { status: "success", data: { extracted } };

    await maybeStoreExtractedKnowledge({
      params: { urls: "https://example.com", storeKnowledge: true },
      req: request,
      provider: "cloudflare",
      extracted,
      result,
    });
    expect(createSource).not.toHaveBeenCalled();
    expect(result.data?.storedKnowledge?.success).toBe(false);
  });

  it.each([false, true])(
    "compensates completed writes and redacts storage errors (cleanup fails: %s)",
    async (cleanupFails) => {
      createSource
        .mockResolvedValueOnce(savedSource)
        .mockRejectedValueOnce(new Error("private provider detail"));
      if (cleanupFails) {
        rollback.mockRejectedValueOnce(new Error("private cleanup detail"));
      }

      const extracted = {
        results: [
          { url: "https://example.com/1", raw_content: "First" },
          { url: "https://example.com/2", raw_content: "Second" },
        ],
        failed_results: [],
        response_time: 1,
      };
      const result: ContentExtractResult = { status: "success", data: { extracted } };

      await maybeStoreExtractedKnowledge({
        params: { urls: "https://example.com", storeKnowledge: true },
        req: request,
        provider: "cloudflare",
        extracted,
        result,
      });
      expect(rollback).toHaveBeenCalledWith(42, "project-1", ["saved"]);
      expect(result.data?.storedKnowledge).toEqual({
        success: false,
        error: "Unable to store extracted content",
      });
      expect(JSON.stringify(result)).not.toContain("private");
    },
  );

  it.each([undefined, "project-1"])(
    "retains the explicit unsupported video-search boundary",
    async (projectId) => {
      await expect(
        generateDocumentFromMedia({
          context: request.context,
          user,
          url: "https://example.com/video.mp4",
          outputs: ["concise_summary"],
          documentType: "general",
          enableVideoSearch: true,
          projectId,
        }),
      ).rejects.toMatchObject({ statusCode: 501 });
    },
  );
});

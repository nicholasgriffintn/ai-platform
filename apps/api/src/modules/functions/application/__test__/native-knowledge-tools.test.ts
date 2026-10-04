import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const createSource = vi.hoisted(() => vi.fn());
const requireProjectAccess = vi.hoisted(() => vi.fn());

vi.mock("~/modules/sources/application/sources", () => ({ createSource }));
vi.mock("~/modules/workspaces/application/access", () => ({ requireProjectAccess }));

import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ContentExtractResult } from "~/modules/apps/application/ports/content-extract";
import { maybeStoreExtractedKnowledge } from "~/modules/apps/infrastructure/retrieval/content-extract/storage";
import { get_note } from "~/modules/functions/application/get_note";
import { search_documents } from "~/modules/functions/application/search_documents";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import type { IRequest } from "~/types";

import { databaseTestEnvironment } from "../../../../../test/environment";
import { savedKnowledgeSource } from "../../../../../test/fixtures/sources/extraction";
import { knowledgeToolTestUser } from "../../../../../test/fixtures/sources/users";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
const user = knowledgeToolTestUser;
let request: IRequest;
const rollback = vi.spyOn(SourceRepository.prototype, "removeCreatedSources");

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
        .mockResolvedValueOnce(savedKnowledgeSource)
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
});

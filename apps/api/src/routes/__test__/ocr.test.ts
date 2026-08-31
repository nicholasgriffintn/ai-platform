import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IUser } from "~/types";

import retrievalRoutes from "../apps/retrieval";

const performOcr = vi.hoisted(() => vi.fn());

vi.mock("~/services/apps/retrieval/ocr", () => ({ performOcr }));

const user = { id: 42, plan_id: "pro" } as IUser;

function createApp() {
  const app = new Hono<{ Variables: { user: IUser } }>();

  app.use("/apps/*", async (context, next) => {
    context.set("user", user);
    await next();
  });
  app.route("/apps", retrievalRoutes);

  return app;
}

describe("OCR route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    performOcr.mockResolvedValue({
      model: "mistral-ocr-4-1",
      outputId: "output-1",
      key: "ocr/output-1/output.md",
      url: "https://assets.example.test/output/output-1",
      outputFormat: "markdown",
      extractedText: "Extracted text",
      response: {
        model: "mistral-ocr-4-1",
        pages: [],
        usage: { pagesProcessed: 1 },
      },
    });
  });

  it("passes validated OCR 4 input and project scope to the sync service", async () => {
    const response = await createApp().request(
      new Request("https://api.polychat.test/apps/ocr?projectId=project-1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "mistral-ocr-4-1",
          document: { type: "source", source_id: "source-1" },
          pages: "0-2,4",
          include_blocks: true,
          confidence_scores_granularity: "word",
          table_format: "html",
          extract_header: true,
          extract_footer: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(performOcr).toHaveBeenCalledWith({
      context: expect.objectContaining({ user }),
      userId: 42,
      projectId: "project-1",
      request: {
        model: "mistral-ocr-4-1",
        document: { type: "source", source_id: "source-1" },
        pages: "0-2,4",
        include_blocks: true,
        confidence_scores_granularity: "word",
        table_format: "html",
        extract_header: true,
        extract_footer: true,
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      outputId: "output-1",
      outputFormat: "markdown",
    });
  });

  it("rejects invalid annotation input before OCR provider orchestration", async () => {
    const response = await createApp().request(
      new Request("https://api.polychat.test/apps/ocr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document: { type: "source", source_id: "source-1" },
          document_annotation_prompt: "Extract fields",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(performOcr).not.toHaveBeenCalled();
  });
});

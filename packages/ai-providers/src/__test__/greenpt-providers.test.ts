import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GreenPtOcrProvider,
  mapPageRange,
} from "../capabilities/ocr/providers/GreenPtOcrProvider.js";
import { GreenPtRerankingProvider } from "../capabilities/reranking/providers/greenpt.js";
import { GreenPtSearchProvider } from "../capabilities/search/providers/GreenPtSearchProvider.js";
import { GreenPtTranscriptionProvider } from "../capabilities/transcription/providers/GreenPtTranscriptionProvider.js";
import type { ProviderEnv, ProviderUser } from "../env.js";
import { selectRerankingModel } from "../model-resolver.js";
import { createTestRuntime, createTestStorage } from "./test-runtime.js";

const mocks = vi.hoisted(() => ({
  persistOcrOutput: vi.fn(),
}));

vi.mock("../capabilities/ocr/format.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../capabilities/ocr/format.js")>()),
  persistOcrOutput: mocks.persistOcrOutput,
}));

const env: ProviderEnv = { GREENPT_API_KEY: "greenpt-key" };
const user: ProviderUser = { id: 42, plan_id: "pro" };
const runtime = createTestRuntime({
  storage: { forEnv: () => null, forContext: () => createTestStorage() },
});
const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastRequest(): { url: URL; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);

  if (!call) {
    throw new Error("fetch was not called");
  }

  return { url: new URL(String(call[0])), init: call[1] ?? {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GreenPtSearchProvider", () => {
  it("uses the index endpoint and maps results into the shared shape", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          { url: "https://a.example", title: "A", description: "first", position: 1 },
          { title: "missing url" },
        ],
      }),
    );

    const result = await new GreenPtSearchProvider(env, user, runtime).performWebSearch("parrots", {
      max_results: 80,
      page: 2,
      language: "en-GB",
    });
    const { url, init } = lastRequest();

    expect(url.pathname).toBe("/v1/tools/search/web");
    expect(init.headers).toMatchObject({ Authorization: "Bearer greenpt-key" });
    expect(JSON.parse(String(init.body))).toEqual({
      query: "parrots",
      maxResults: 50,
      page: 2,
      country: "en-GB",
    });
    expect(result).toEqual({
      provider: "greenpt",
      results: [
        { title: "A", url: "https://a.example", snippet: "first", position: 1, favicon: undefined },
      ],
    });
  });

  it("switches to the enriched websearch endpoint when raw content is requested", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        note: "fetched",
        results: [
          { title: "B", link: "https://b.example", snippet: "s", relevant_content: "body" },
        ],
      }),
    );

    const result = await new GreenPtSearchProvider(env, user, runtime).performWebSearch("parrots", {
      include_raw_content: true,
      max_results: 3,
    });
    const { url, init } = lastRequest();

    expect(url.pathname).toBe("/v1/tools/websearch");
    expect(JSON.parse(String(init.body))).toEqual({
      query: "parrots",
      count: 3,
      force_fetch: true,
    });
    expect(result).toMatchObject({
      provider: "greenpt",
      note: "fetched",
      results: [{ url: "https://b.example", relevant_content: "body", position: 1 }],
    });
  });

  it("returns a search error instead of throwing on upstream failure", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));

    const result = await new GreenPtSearchProvider(env, user, runtime).performWebSearch("x");

    if (!("status" in result) || result.status !== "error") {
      throw new Error("Expected GreenPT search to return an error result");
    }

    expect(result.error).toContain("429");
  });
});

describe("GreenPtRerankingProvider", () => {
  it("selects GreenPT reranking when access comes from a user key", () => {
    expect(
      selectRerankingModel(
        {
          "greenpt/green-rerank": {
            matchingModel: "green-rerank",
            provider: "greenpt",
            modalities: { input: ["text"], output: ["reranking"] },
            isPlatformEnabled: false,
            isByokEnabled: true,
          },
        },
        {},
        { provider: "greenpt" },
      ),
    ).toEqual({ model: "green-rerank", provider: "greenpt" });
  });

  it("posts the shared reranking contract and maps scores back to opaque document IDs", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        model: "green-rerank",
        usage: { total_tokens: 12 },
        results: [
          { index: 1, relevance_score: 0.9, document: { text: "second" } },
          { index: 0, relevance_score: 0.1 },
        ],
      }),
    );

    const result = await new GreenPtRerankingProvider(env, user, runtime).rerank({
      query: "which is second",
      documents: [
        { id: "doc-1", text: "first" },
        { id: "doc-2", text: "second" },
      ],
      topK: 2,
    });
    const { url, init } = lastRequest();

    expect(url.pathname).toBe("/v1/rerank");
    expect(JSON.parse(String(init.body))).toEqual({
      model: "green-rerank",
      query: "which is second",
      documents: ["first", "second"],
      top_n: 2,
      return_documents: false,
    });
    expect(result).toEqual({
      provider: "greenpt",
      model: "green-rerank",
      results: [
        { id: "doc-2", score: 0.9 },
        { id: "doc-1", score: 0.1 },
      ],
      usage: { input_tokens: 12 },
    });
  });

  it("rejects unsupported models and empty document sets before calling upstream", async () => {
    const provider = new GreenPtRerankingProvider(env, user, runtime);

    await expect(
      provider.rerank({ query: "q", documents: [], model: "green-rerank" }),
    ).rejects.toThrow("Invalid reranking request");
    await expect(
      provider.rerank({ query: "q", documents: [{ id: 0, text: "a" }], model: "other" }),
    ).rejects.toThrow("not supported");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GreenPtTranscriptionProvider", () => {
  it("streams the raw audio body with Token auth and query options", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        metadata: { request_id: "req-1", duration: 2.5 },
        results: {
          channels: [{ alternatives: [{ transcript: "hello there", confidence: 0.9 }] }],
        },
      }),
    );

    const result = await new GreenPtTranscriptionProvider(runtime).transcribe({
      env,
      user,
      audio: { kind: "file", file: new Blob(["audio"], { type: "audio/wav" }) },
      model: "green-s-pro",
      language: "multi",
      timestamps: true,
    });
    const { url, init } = lastRequest();

    expect(url.pathname).toBe("/v1/listen");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      model: "green-s-pro",
      language: "multi",
      punctuate: "true",
      diarize_model: "latest",
    });
    expect(init.headers).toMatchObject({
      Authorization: "Token greenpt-key",
      "Content-Type": "audio/wav",
    });
    expect(init.body).toBeInstanceOf(Blob);
    expect(result).toMatchObject({
      text: "hello there",
      metadata: { model: "green-s-pro", requestId: "req-1", duration: 2.5 },
    });
  });

  it("fails when the transcript is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: { channels: [] } }));

    await expect(
      new GreenPtTranscriptionProvider(runtime).transcribe({
        env,
        user,
        audio: { kind: "file", file: new Blob(["audio"]) },
      }),
    ).rejects.toThrow("No transcription text returned from GreenPT");
  });
});

describe("GreenPtOcrProvider", () => {
  beforeEach(() => {
    mocks.persistOcrOutput.mockResolvedValue({
      outputId: "output-1",
      key: "ocr/request-1/output.md",
      url: "https://assets.example.com/output/output-1",
      outputFormat: "markdown",
    });
  });

  it("maps zero-based page selections onto docling's one-based page_range", () => {
    expect(mapPageRange(undefined)).toBeUndefined();
    expect(mapPageRange([0, 1, 2])).toBe("1,3");
    expect(mapPageRange("1-3")).toBe("2,4");
    expect(() => mapPageRange("1-3,7")).toThrow("one continuous page range");
  });

  it("uploads data URLs as multipart files and persists the markdown output", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: "completed",
        document: { filename: "report.pdf", md_content: "# Report\n\nBody" },
      }),
    );

    const result = await new GreenPtOcrProvider(runtime).extractText({
      env,
      user,
      id: "request-1",
      document: {
        type: "document_url",
        document_url: `data:application/pdf;base64,${btoa("%PDF-1.4")}`,
        document_name: "report.pdf",
      },
      pages: [0, 1],
    });
    const { url, init } = lastRequest();

    if (!(init.body instanceof FormData)) {
      throw new Error("Expected GreenPT OCR to send multipart form data");
    }

    const form = init.body;
    const file = form.get("files");

    if (!(file instanceof File)) {
      throw new Error("Expected GreenPT OCR to upload a file");
    }

    expect(url.pathname).toBe("/v1/tools/documents/convert/file");
    expect(form.get("to_formats")).toBe("md");
    expect(form.get("page_range")).toBe("1,2");
    expect(file.name).toBe("report.pdf");
    expect(result.extractedText).toContain("# Report");
    expect(result.response.pages[0]?.markdown).toBe("# Report\n\nBody");
    expect(mocks.persistOcrOutput).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "request-1", outputFormat: "markdown" }),
    );
  });

  it("refuses to fetch private or non-HTTP document URLs", async () => {
    const provider = new GreenPtOcrProvider(runtime);

    await expect(
      provider.extractText({
        env,
        user,
        document: { type: "document_url", document_url: "http://169.254.169.254/latest" },
      }),
    ).rejects.toThrow("public HTTP(S) URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses redirects from public document URLs to private hosts", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest" },
      }),
    );

    await expect(
      new GreenPtOcrProvider(runtime).extractText({
        env,
        user,
        document: { type: "document_url", document_url: "https://files.example/report.pdf" },
      }),
    ).rejects.toThrow("public HTTP(S) URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

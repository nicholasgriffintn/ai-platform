import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnthropicBatchProvider, OpenAiBatchProvider } from "../capabilities/batch/index.js";
import type { ProviderEnv } from "../env.js";
import { createTestRuntime } from "./test-runtime.js";

const env: ProviderEnv = { OPENAI_API_KEY: "openai-key", ANTHROPIC_API_KEY: "anthropic-key" };
const runtime = createTestRuntime();
const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

function lines(...values: unknown[]): Response {
  return new Response(values.map((value) => JSON.stringify(value)).join("\n"));
}

const items = [
  { id: "case_0", model: "model-a", prompt: "2+2?", system: "Be brief.", maxTokens: 64 },
  { id: "case_1", model: "model-a", prompt: "Capital of France?", maxTokens: 64 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAiBatchProvider", () => {
  it("uploads one JSONL line per item and starts a 24-hour chat completions batch", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "file-1" }))
      .mockResolvedValueOnce(json({ id: "batch-1", status: "validating" }));

    await expect(new OpenAiBatchProvider(env, runtime).submit(items)).resolves.toEqual({
      batchId: "batch-1",
    });

    const [uploadUrl, upload] = fetchMock.mock.calls[0] ?? [];
    const file = upload?.body instanceof FormData ? upload.body.get("file") : null;
    const uploaded =
      file instanceof Blob ? (await file.text()).split("\n").map((line) => JSON.parse(line)) : [];

    expect(String(uploadUrl)).toBe("https://api.openai.com/v1/files");
    expect(upload?.headers).toMatchObject({ Authorization: "Bearer openai-key" });
    expect(uploaded[0]).toEqual({
      custom_id: "case_0",
      method: "POST",
      url: "/v1/chat/completions",
      body: {
        model: "model-a",
        max_completion_tokens: 64,
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "2+2?" },
        ],
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      input_file_id: "file-1",
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
    });
  });

  it("reports progress, then merges output and error files once completed", async () => {
    const provider = new OpenAiBatchProvider(env, runtime);

    fetchMock.mockResolvedValueOnce(json({ id: "batch-1", status: "in_progress" }));
    await expect(provider.poll("batch-1")).resolves.toEqual({ status: "in_progress" });

    fetchMock
      .mockResolvedValueOnce(
        json({ id: "batch-1", status: "completed", output_file_id: "out", error_file_id: "err" }),
      )
      .mockResolvedValueOnce(
        lines({
          custom_id: "case_0",
          response: { status_code: 200, body: { choices: [{ message: { content: "4" } }] } },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        lines({ custom_id: "case_1", response: null, error: { message: "rate limited" } }),
      );

    await expect(provider.poll("batch-1")).resolves.toEqual({
      status: "completed",
      results: [
        { id: "case_0", text: "4" },
        { id: "case_1", error: "rate limited" },
      ],
    });
  });

  it("treats an expired batch as failed", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: "batch-1", status: "expired" }));

    await expect(new OpenAiBatchProvider(env, runtime).poll("batch-1")).resolves.toEqual({
      status: "failed",
      reason: "The OpenAI batch ended with status expired",
    });
  });
});

describe("AnthropicBatchProvider", () => {
  it("submits message batch requests with the system prompt as a top-level field", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: "msgbatch_1", processing_status: "in_progress" }));

    await new AnthropicBatchProvider(env, runtime).submit(items);

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe("https://api.anthropic.com/v1/messages/batches");
    expect(init?.headers).toMatchObject({
      "x-api-key": "anthropic-key",
      "anthropic-version": "2023-06-01",
    });
    expect(JSON.parse(String(init?.body)).requests[0]).toEqual({
      custom_id: "case_0",
      params: {
        model: "model-a",
        max_tokens: 64,
        system: "Be brief.",
        messages: [{ role: "user", content: "2+2?" }],
      },
    });
  });

  it("reads succeeded and errored results once the batch has ended", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          id: "msgbatch_1",
          processing_status: "ended",
          results_url: "https://api.anthropic.com/v1/messages/batches/msgbatch_1/results",
        }),
      )
      .mockResolvedValueOnce(
        lines(
          {
            custom_id: "case_0",
            result: { type: "succeeded", message: { content: [{ type: "text", text: "4" }] } },
          },
          {
            custom_id: "case_1",
            result: { type: "errored", error: { error: { message: "overloaded" } } },
          },
        ),
      );

    await expect(new AnthropicBatchProvider(env, runtime).poll("msgbatch_1")).resolves.toEqual({
      status: "completed",
      results: [
        { id: "case_0", text: "4" },
        { id: "case_1", error: "overloaded" },
      ],
    });
  });

  it("never sends the API key to a results URL on another host", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        id: "msgbatch_1",
        processing_status: "ended",
        results_url: "https://attacker.example/results",
      }),
    );

    await expect(new AnthropicBatchProvider(env, runtime).poll("msgbatch_1")).resolves.toEqual({
      status: "failed",
      reason: "The Anthropic batch ended without usable results",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

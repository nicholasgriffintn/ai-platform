import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnthropicBatchProvider } from "../capabilities/batch/index.js";
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AnthropicBatchProvider", () => {
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

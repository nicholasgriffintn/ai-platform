import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { MistralOcrBatchClient } from "./MistralOcrBatchClient";

vi.mock("~/lib/providers/utils/apiKeys", () => ({
  resolveProviderApiKey: vi.fn().mockResolvedValue("mistral-key"),
}));

const env = {
  ACCOUNT_ID: "account-1",
  AI_GATEWAY_TOKEN: "gateway-token",
} as IEnv;
const user = { id: 42 } as IUser;

describe("MistralOcrBatchClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts an OCR batch with bounded inline requests", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "job-1",
          status: "QUEUED",
          total_requests: 1,
          completed_requests: 0,
          succeeded_requests: 0,
          failed_requests: 0,
        }),
        { status: 200 },
      ),
    );

    const result = await new MistralOcrBatchClient().start({
      env,
      user,
      model: "mistral-ocr-latest",
      requests: [
        {
          customId: "input-1",
          body: {
            document: { type: "image_url", image_url: "https://example.com/page.png" },
            include_blocks: true,
            confidence_scores_granularity: "block",
          },
        },
      ],
      metadata: { outputId: "output-1" },
    });

    expect(result).toMatchObject({ id: "job-1", status: "QUEUED" });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(String(url)).toContain("/mistral/v1/batch/jobs");
    expect(init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer mistral-key",
        "cf-aig-authorization": "gateway-token",
      }),
    });
    expect(body).toEqual({
      endpoint: "/v1/ocr",
      model: "mistral-ocr-latest",
      requests: [
        {
          custom_id: "input-1",
          body: {
            document: { type: "image_url", image_url: "https://example.com/page.png" },
            include_blocks: true,
            confidence_scores_granularity: "block",
          },
        },
      ],
      metadata: { outputId: "output-1" },
    });
  });

  it("rejects a successful response that is not a complete batch job", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    await expect(
      new MistralOcrBatchClient().get({ env, user, jobId: "job-1" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

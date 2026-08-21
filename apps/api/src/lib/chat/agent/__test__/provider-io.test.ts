import { describe, expect, it } from "vitest";

import { createAgentProviderIO } from "../provider-io";

const providerIO = createAgentProviderIO();

describe("createAgentProviderIO", () => {
  it("keeps a pending async invocation placeholder that providers return as content parts", () => {
    const asyncInvocation = {
      provider: "replicate",
      id: "prediction-1",
      type: "replicate.prediction",
      status: "in_progress",
    };

    const modelResponse = providerIO.modelResponse({
      response: [
        {
          type: "text",
          text: "Generation in progress. We'll update this message once the results are ready.",
        },
      ],
      status: "in_progress",
      data: { asyncInvocation },
    });

    expect(modelResponse.response).toBe(
      "Generation in progress. We'll update this message once the results are ready.",
    );
    expect((modelResponse.data as { asyncInvocation: unknown }).asyncInvocation).toEqual(
      asyncInvocation,
    );
  });

  it("returns no response text when the provider returns non-text content parts", () => {
    expect(
      providerIO.modelResponse({ response: [{ type: "image_url" }] }).response,
    ).toBeUndefined();
  });
});

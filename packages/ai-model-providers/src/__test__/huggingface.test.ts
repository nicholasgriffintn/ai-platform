import { describe, expect, it, vi } from "vitest";

import { HuggingFaceHubClient, isModelProviderError } from "../index.js";

describe("HuggingFaceHubClient", () => {
  it("rejects repository and revision strings that would escape the API path", async () => {
    const fetcher = vi.fn();
    const client = new HuggingFaceHubClient({ fetcher });

    await expect(
      client.getRepoInfo({ kind: "model", repo: "../../api/whoami", revision: "main" }),
    ).rejects.toSatisfy((error) => isModelProviderError(error, "invalid_reference"));
    await expect(
      client.listFiles({ kind: "model", repo: "a/b", revision: "../../settings" }),
    ).rejects.toSatisfy((error) => isModelProviderError(error, "invalid_reference"));
    expect(fetcher).not.toHaveBeenCalled();
  });
});

import type { KVNamespace } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ErrorType } from "~/utils/errors";

import { deleteProviderApiKey } from "../userOperations";

describe("provider credential cache invalidation", () => {
  it("reports a failed invalidation after deleting a provider credential", async () => {
    const deleteStoredKey = vi.fn().mockResolvedValue(undefined);
    const cache = {
      delete: vi.fn().mockRejectedValue(new Error("KV unavailable")),
    } as unknown as KVNamespace;
    const context = {
      ensureDatabase: vi.fn(),
      env: { CACHE: cache },
      repositories: {
        userSettings: {
          deleteProviderApiKey: deleteStoredKey,
        },
      },
    } as unknown as ServiceContext;

    await expect(deleteProviderApiKey(context, "openai", 42)).rejects.toMatchObject({
      type: ErrorType.INTERNAL_ERROR,
    });

    expect(deleteStoredKey).toHaveBeenCalledWith(42, "openai");
  });
});

import { SandboxError } from "./errors.js";

export interface LeaseFenceStore {
  read(): Promise<number | null>;
  write(fence: number): Promise<void>;
}

export interface LeaseFence {
  current(): Promise<number>;
  assert(fence: number | undefined): Promise<void>;
  ensureInitialised(): Promise<number>;
  revoke(fence: number | undefined): Promise<void>;
}

export function isValidLeaseFence(fence: unknown): fence is number {
  return typeof fence === "number" && Number.isSafeInteger(fence) && fence > 0;
}

function requireFence(fence: number | undefined): number {
  if (!isValidLeaseFence(fence)) {
    throw new SandboxError("invalid_lease", "A valid lease fence is required");
  }

  return fence;
}

export function createLeaseFence(store: LeaseFenceStore): LeaseFence {
  const current = async (): Promise<number> => {
    const value = await store.read();

    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  const assert = async (fence: number | undefined): Promise<void> => {
    const required = requireFence(fence);
    const known = await current();

    if (required < known) {
      throw new SandboxError("stale_lease", "The lease is stale", { fence: required, known });
    }

    if (required > known) {
      await store.write(required);
    }
  };

  return {
    current,
    assert,
    ensureInitialised: async () => {
      const known = await current();

      if (known >= 1) {
        return known;
      }

      await store.write(1);

      return 1;
    },
    revoke: async (fence) => {
      const required = requireFence(fence);
      const known = await current();

      if (known === required + 1) {
        return;
      }

      await assert(required);
      await store.write(required + 1);
    },
  };
}

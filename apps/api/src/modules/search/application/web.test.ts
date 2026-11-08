import { describe, expect, it } from "vitest";

import { getAuxiliarySearchProvider } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

const env: IEnv = {
  ACCOUNT_ID: "test-account",
  ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET: undefined,
  PRIVATE_ASSETS_BUCKET_NAME: "private",
  ASSETS_BUCKET_ACCESS_KEY_ID: "",
  ASSETS_BUCKET_SECRET_ACCESS_KEY: "",
  get AI(): never {
    throw new Error("Unexpected AI binding access");
  },
  get DB(): never {
    throw new Error("Unexpected database access");
  },
  get CACHE(): never {
    throw new Error("Unexpected cache access");
  },
  get TELEMETRY_STREAM(): never {
    throw new Error("Unexpected telemetry access");
  },
  get VECTOR_DB(): never {
    throw new Error("Unexpected vector store access");
  },
};
const user: IUser = {
  id: 42,
  email: "user@example.com",
  plan_id: "pro",
  name: null,
  avatar_url: null,
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "",
  updated_at: "",
  setup_at: null,
  terms_accepted_at: null,
};

describe("platform search access", () => {
  it("requires Pro for platform search and rejects before querying", async () => {
    await expect(
      getAuxiliarySearchProvider(env, { ...user, plan_id: "free" }, "cloudflare"),
    ).rejects.toMatchObject({ type: "AUTHORISATION_ERROR" });
    await expect(getAuxiliarySearchProvider(env, undefined, "cloudflare")).rejects.toMatchObject({
      type: "AUTHORISATION_ERROR",
    });
    await expect(getAuxiliarySearchProvider(env, user, "cloudflare")).resolves.toBe("cloudflare");
  });
});

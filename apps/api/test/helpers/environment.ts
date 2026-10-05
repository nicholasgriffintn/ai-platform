import type { D1Database } from "@cloudflare/workers-types";

import type { IEnv } from "~/types";

export function databaseTestEnvironment(database: D1Database): IEnv {
  return {
    DB: database,
    get AI(): never {
      throw new Error("Unexpected AI binding access");
    },
    get ANALYTICS(): never {
      throw new Error("Unexpected analytics binding access");
    },
    get VECTOR_DB(): never {
      throw new Error("Unexpected vector binding access");
    },
    get CACHE() {
      throw new Error("Unexpected cache binding access");
    },
    ASSETS_BUCKET: undefined,
    PRIVATE_ASSETS_BUCKET: undefined,
    PRIVATE_ASSETS_BUCKET_NAME: "test-private-assets",
    ACCOUNT_ID: "test-account",
    ASSETS_BUCKET_ACCESS_KEY_ID: "",
    ASSETS_BUCKET_SECRET_ACCESS_KEY: "",
  };
}

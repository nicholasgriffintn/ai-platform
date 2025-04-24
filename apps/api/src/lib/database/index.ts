import type { D1Database } from "@cloudflare/workers-types";

import * as schema from "./schema";

export interface Env {
  DB: D1Database;
}

export { schema };

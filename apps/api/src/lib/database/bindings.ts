import type { D1Database } from "@cloudflare/workers-types";

import { isRecord } from "~/utils/objects";

export interface EnvWithD1Database {
	DB: D1Database;
}

export function hasD1DatabaseBinding(env: unknown): env is EnvWithD1Database {
	if (!isRecord(env)) return false;

	const db = env.DB;
	return isRecord(db) && typeof db.prepare === "function";
}

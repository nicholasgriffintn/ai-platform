import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateSQLiteDrizzleJson } from "drizzle-kit/api";

import * as schema from "../src/lib/database/schema";

const MIGRATIONS_DIR = "migrations";
const META_DIR = join(MIGRATIONS_DIR, "meta");

function latestSnapshotBefore(tag: string): string {
  const snapshots = readdirSync(META_DIR)
    .filter((name) => name.endsWith("_snapshot.json") && name < `${tag}_`)
    .sort();
  const latest = snapshots.at(-1);

  if (!latest) {
    throw new Error(`No snapshot found before ${tag}`);
  }

  return join(META_DIR, latest);
}

async function main() {
  const tag = process.argv[2];

  if (!tag) {
    throw new Error("Usage: generate-rename-snapshot <migration tag, e.g. 0033>");
  }

  const previous = JSON.parse(readFileSync(latestSnapshotBefore(tag), "utf8")) as { id: string };
  const snapshot = await generateSQLiteDrizzleJson(
    schema as unknown as Record<string, unknown>,
    previous.id,
  );

  writeFileSync(join(META_DIR, `${tag}_snapshot.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${tag}_snapshot.json from the current schema.`);
}

await main();

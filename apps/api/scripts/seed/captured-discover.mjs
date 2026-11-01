import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DISCOVER_EDITION_KIND, DISCOVER_EPISODE_KIND } from "@ngriffin_uk/polychat-schemas";

import { insert, moveDates, NOW } from "./sql.mjs";

const TABLES = ["resource_collection", "resource", "resource_revision", "resource_link"];
const capture = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "discover/captured.json"),
    "utf8",
  ),
);
const rows = JSON.parse(
  moveDates(JSON.stringify(capture.rows), {
    around: capture.date,
    milliseconds: NOW.getTime() - Date.parse(capture.capturedAt),
    days: Math.round(
      (Date.parse(NOW.toISOString().slice(0, 10)) - Date.parse(capture.date)) / 86_400_000,
    ),
  }),
);

function capturedOutput(kind) {
  const output = rows.resource.find((resource) => resource.kind === kind);

  return { id: output.id, content: JSON.parse(output.content) };
}

export const CAPTURED_EDITION = capturedOutput(DISCOVER_EDITION_KIND);
export const CAPTURED_EPISODE = capturedOutput(DISCOVER_EPISODE_KIND);

export function capturedStatements() {
  return TABLES.flatMap((table) => rows[table].map((row) => insert(table, row)));
}

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SEED_ROOT = path.join(API_ROOT, "scripts/seed");
const CAPTURE_DIRECTORY = "discover";
const OWNER_ID = 1;

function localDatabasePath() {
  const directory = path.join(API_ROOT, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const result = spawnSync("find", [directory, "-name", "*.sqlite", "-size", "+100k"], {
    encoding: "utf8",
  });
  const [file] = result.stdout.split("\n").filter(Boolean);

  if (!file) {
    throw new Error("No local D1 database found. Run the API locally first.");
  }

  return file;
}

function openCopy(scratch) {
  const source = localDatabasePath();
  const target = path.join(scratch, "db.sqlite");

  copyFileSync(source, target);

  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(`${source}${suffix}`)) {
      copyFileSync(`${source}${suffix}`, `${target}${suffix}`);
    }
  }

  return new DatabaseSync(target, { readOnly: true });
}

function storedColumns(db, table) {
  return db
    .prepare(`SELECT name FROM pragma_table_xinfo('${table}') WHERE hidden = 0`)
    .all()
    .map((column) => column.name);
}

function selectRows(db, table, where, values) {
  const columns = storedColumns(db, table);

  return db
    .prepare(
      `SELECT ${columns.map((column) => `"${column}"`).join(", ")} FROM "${table}" WHERE ${where}`,
    )
    .all(...values);
}

function parse(value) {
  return typeof value === "string" ? JSON.parse(value) : (value ?? {});
}

function placeholders(values) {
  return values.length > 0 ? values.map(() => "?").join(", ") : "NULL";
}

function main() {
  const scratch = mkdtempSync(path.join(tmpdir(), "polychat-discover-capture-"));
  const db = openCopy(scratch);

  try {
    const [edition] = selectRows(
      db,
      "resource",
      "resource_type = 'output' AND kind = 'discover.edition' AND created_by_user_id = ? AND id NOT LIKE 'seed%' ORDER BY datetime(created_at) DESC LIMIT 1",
      [OWNER_ID],
    );

    if (!edition) {
      throw new Error("No generated Discover edition to capture.");
    }

    const editionContent = parse(edition.content);
    const windowStart = new Date(Date.parse(`${editionContent.date}T00:00:00Z`)).toISOString();
    const listen = editionContent.listenSourceId
      ? selectRows(db, "resource", "id = ?", [editionContent.listenSourceId])
      : [];
    const listenSourceIds = listen.flatMap(
      (source) => parse(source.metadata).generation?.sourceIds ?? [],
    );
    const episode = editionContent.episodeId
      ? selectRows(db, "resource", "id = ?", [editionContent.episodeId])
      : [];
    const outputs = selectRows(
      db,
      "resource",
      `resource_type = 'output' AND created_by_user_id = ? AND id NOT LIKE 'seed%'
       AND kind IN ('discover.wind_down', 'flashcards', 'quiz')
       AND datetime(created_at) >= datetime(?)`,
      [OWNER_ID, windowStart],
    );
    const textSources = selectRows(
      db,
      "resource",
      `resource_type = 'source' AND created_by_user_id = ? AND kind = 'text' AND status = 'available'
       AND (id LIKE 'discover_%' OR id IN (${placeholders(listenSourceIds)}))
       AND datetime(created_at) >= datetime(?)`,
      [OWNER_ID, ...listenSourceIds, windowStart],
    );
    const collections = selectRows(
      db,
      "resource_collection",
      `created_by_user_id = ? AND id NOT LIKE 'seed%' AND datetime(created_at) >= datetime(?)`,
      [OWNER_ID, windowStart],
    );
    const collectionIds = collections.map((collection) => collection.id);
    const articles = selectRows(
      db,
      "resource",
      `resource_type = 'source' AND kind = 'url' AND status = 'available' AND created_by_user_id = ?
       AND id IN (SELECT source_id FROM resource_link WHERE kind = 'source_collection'
         AND collection_id IN (${placeholders(collectionIds)}))`,
      [OWNER_ID, ...collectionIds],
    );
    const resources = [edition, ...episode, ...listen, ...outputs, ...textSources, ...articles];
    const resourceIds = new Set(resources.map((resource) => resource.id));
    const knownIds = [...resourceIds];
    const links = selectRows(
      db,
      "resource_link",
      `(source_id IN (${placeholders(knownIds)}) OR output_id IN (${placeholders(knownIds)}))`,
      [...knownIds, ...knownIds],
    ).filter(
      (link) =>
        (!link.related_source_id || resourceIds.has(link.related_source_id)) &&
        (!link.collection_id ||
          collectionIds.includes(link.collection_id) ||
          link.collection_id.startsWith("seed")),
    );
    const revisions = selectRows(
      db,
      "resource_revision",
      `output_id IN (${placeholders(knownIds)}) OR source_id IN (${placeholders(knownIds)})`,
      [...knownIds, ...knownIds],
    );
    const captured = {
      date: editionContent.date,
      capturedAt: new Date().toISOString(),
      rows: {
        resource_collection: collections,
        resource: resources,
        resource_revision: revisions,
        resource_link: links,
      },
    };

    mkdirSync(path.join(SEED_ROOT, CAPTURE_DIRECTORY), { recursive: true });
    writeFileSync(
      path.join(SEED_ROOT, `${CAPTURE_DIRECTORY}/captured.json`),
      `${JSON.stringify(captured, null, 2)}\n`,
    );

    console.log(
      `Captured ${resources.length} resources, ${collections.length} collections, ${links.length} links, ${revisions.length} revisions for ${editionContent.date}.`,
    );
  } finally {
    db.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}

main();

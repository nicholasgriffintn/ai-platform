#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSeed } from "./seed/index.mjs";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = {
  local: { database: "personal-assistant", flag: "--local" },
  preview: { database: "personal-assistant-preview", flag: "--remote" },
};
const CHUNK_BYTES = 80_000;

function parseArguments(argv) {
  const options = {
    target: null,
    yes: false,
    dryRun: false,
    keep: false,
    persistTo: null,
    sqlOut: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--target":
        options.target = argv[++index];
        break;
      case "--yes":
        options.yes = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--keep":
        options.keep = true;
        break;
      case "--persist-to":
        options.persistTo = path.resolve(argv[++index]);
        break;
      case "--sql-out":
        options.sqlOut = path.resolve(argv[++index]);
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.dryRun && !TARGETS[options.target]) {
    throw new Error("Pass --target local or --target preview (or --dry-run with --sql-out).");
  }

  return options;
}

function readDevVar(name) {
  const file = path.join(API_ROOT, ".dev.vars");

  if (!existsSync(file)) {
    return null;
  }

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(new RegExp(`^${name}\\s*=\\s*(.*)$`));

    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  return null;
}

function resolveServerKey(target) {
  const fromEnvironment = process.env.PRIVATE_KEY?.trim();

  if (fromEnvironment) {
    return fromEnvironment;
  }

  return target === "local" ? readDevVar("PRIVATE_KEY") : null;
}

function wrangler(args, { json = false } = {}) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: API_ROOT,
    encoding: "utf8",
    stdio: json ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`wrangler ${args.join(" ")} failed with exit code ${result.status}`);
  }

  return json ? JSON.parse(result.stdout) : null;
}

function childrenFirst(tables) {
  const parents = new Map(
    tables.map((table) => [
      table.name,
      new Set(
        [...(table.sql ?? "").matchAll(/REFERENCES\s+[`"]?([A-Za-z0-9_]+)[`"]?/gi)]
          .map((match) => match[1])
          .filter((parent) => parent !== table.name),
      ),
    ]),
  );
  const ordered = [];
  const remaining = new Set(parents.keys());

  while (remaining.size > 0) {
    const leaves = [...remaining].filter(
      (name) => ![...remaining].some((other) => other !== name && parents.get(other).has(name)),
    );
    const batch = leaves.length > 0 ? leaves : [...remaining];

    for (const name of batch) {
      ordered.push(name);
      remaining.delete(name);
    }
  }

  return ordered;
}

function dropAllTables(target, persist) {
  const rows = wrangler(
    [
      "d1",
      "execute",
      target.database,
      target.flag,
      ...persist,
      "--json",
      "--command",
      "SELECT type, name, sql FROM sqlite_master WHERE type IN ('trigger', 'view', 'table')",
    ],
    { json: true },
  );
  const objects = rows
    .flatMap((batch) => batch.results ?? [])
    .filter((row) => !row.name.startsWith("sqlite_") && !row.name.startsWith("_cf_"));
  const drops = [
    ...objects
      .filter((row) => row.type === "trigger")
      .map((row) => `DROP TRIGGER IF EXISTS "${row.name}";`),
    ...objects
      .filter((row) => row.type === "view")
      .map((row) => `DROP VIEW IF EXISTS "${row.name}";`),
    ...childrenFirst(objects.filter((row) => row.type === "table")).map(
      (name) => `DROP TABLE IF EXISTS "${name}";`,
    ),
  ];

  if (drops.length === 0) {
    return;
  }

  const file = path.join(mkdtempSync(path.join(tmpdir(), "polychat-seed-")), "drop.sql");

  writeFileSync(file, ["PRAGMA defer_foreign_keys = ON;", ...drops].join("\n"));
  wrangler(["d1", "execute", target.database, target.flag, ...persist, "--file", file]);
  console.log(`Dropped ${drops.length} objects from ${target.database}`);
}

function chunkStatements(statements) {
  const chunks = [];
  let current = [];
  let size = 0;

  for (const statement of statements) {
    if (size + statement.length > CHUNK_BYTES && current.length > 0) {
      chunks.push(current);
      current = [];
      size = 0;
    }

    current.push(statement);
    size += statement.length;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function renderChunk(statements) {
  return ["PRAGMA defer_foreign_keys = ON;", ...statements].join("\n");
}

function printSummary(seed, target, options) {
  console.log("");
  console.log(
    `Seeded ${seed.statements.length} statements into ${target?.database ?? options.sqlOut}.`,
  );
  console.log("");
  console.log("Sign in");
  console.log(
    `  GitHub: ${seed.login.githubUsername} (${seed.login.email}) is the admin on the Pro plan.`,
  );
  console.log(`  Cookie: set session=${seed.login.sessionToken} on the app origin to skip OAuth.`);
  console.log(`  API:    Authorization: Bearer ${seed.login.apiKey}`);

  if (!seed.login.encryptedKeysSeeded) {
    console.log(
      "  Note:   PRIVATE_KEY was not available, so user encryption keys and project environment variables were skipped.",
    );
  }

  console.log("");
  console.log("Scenarios");

  for (const scenario of seed.scenarios) {
    console.log(`  [${scenario.tag}] ${scenario.title}`);
  }

  console.log("");
  console.log("Open the pinned 'Start here · Seed guide' conversation for the full walkthrough.");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const target = options.target ? TARGETS[options.target] : null;
  const serverKey = resolveServerKey(options.target);
  const seed = await buildSeed({ serverKey });

  if (options.sqlOut) {
    writeFileSync(options.sqlOut, seed.statements.join("\n"));
    console.log(`Wrote ${seed.statements.length} statements to ${options.sqlOut}`);
  }

  if (options.dryRun) {
    return;
  }

  if (options.target === "preview" && !options.yes) {
    throw new Error(
      "Rebuilding the preview database drops every table. Re-run with --yes to confirm.",
    );
  }

  const persist = options.persistTo ? ["--persist-to", options.persistTo] : [];

  if (!options.keep) {
    dropAllTables(target, persist);
  }

  wrangler(["d1", "migrations", "apply", target.database, target.flag, ...persist]);

  const directory = mkdtempSync(path.join(tmpdir(), "polychat-seed-"));
  const chunks = chunkStatements(seed.statements);

  chunks.forEach((chunk, index) => {
    const file = path.join(directory, `seed-${String(index + 1).padStart(3, "0")}.sql`);

    writeFileSync(file, renderChunk(chunk));
    wrangler(["d1", "execute", target.database, target.flag, "--file", file, ...persist]);
    console.log(`Applied chunk ${index + 1}/${chunks.length} (${chunk.length} statements)`);
  });

  rmSync(directory, { force: true, recursive: true });
  printSummary(seed, target, options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

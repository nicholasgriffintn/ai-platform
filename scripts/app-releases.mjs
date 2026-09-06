#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hasDirectChanges, readChangelogEntry } from "./lib/changelog.mjs";
import { RELEASE_APPS, readAppVersion, releaseTag } from "./lib/release-apps.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readOption(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);

  return index === -1 ? undefined : process.argv[index + 1];
}

function tagExists(tag) {
  const found = execFileSync("git", ["tag", "--list", tag], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  return found.trim() !== "";
}

function readChangelog(app) {
  try {
    return readFileSync(join(repositoryRoot, app.directory, "CHANGELOG.md"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function planApp(app) {
  const version = readAppVersion(repositoryRoot, app);
  const tag = releaseTag(app, version);
  const changelog = readChangelog(app);
  const notes = changelog === null ? null : readChangelogEntry(changelog, version);

  return {
    id: app.id,
    name: app.name,
    directory: app.directory,
    title: app.title,
    version,
    tag,
    notes,
    release: hasDirectChanges(notes) && !tagExists(tag),
  };
}

function writeNotes(directory, plan) {
  mkdirSync(directory, { recursive: true });

  const file = join(directory, `${plan.id}.md`);

  writeFileSync(file, `${plan.notes}\n`);

  return file;
}

function writeOutputs(outputs) {
  const file = process.env.GITHUB_OUTPUT;

  if (!file) {
    return;
  }

  for (const [key, value] of Object.entries(outputs)) {
    appendFileSync(file, `${key}=${value}\n`);
  }
}

const plans = RELEASE_APPS.map(planApp);
const releasing = plans.filter((plan) => plan.release);
const notesDirectory = readOption("notes-dir");

if (notesDirectory) {
  for (const plan of releasing) {
    plan.notesFile = writeNotes(resolve(repositoryRoot, notesDirectory), plan);
  }
}

writeOutputs({
  any: String(releasing.length > 0),
  releases: JSON.stringify(
    releasing.map((plan) => ({
      id: plan.id,
      tag: plan.tag,
      title: plan.title,
      version: plan.version,
      notesFile: plan.notesFile,
    })),
  ),
  ...Object.fromEntries(plans.map((plan) => [plan.id, String(plan.release)])),
});

process.stdout.write(`${JSON.stringify(plans, null, 2)}\n`);

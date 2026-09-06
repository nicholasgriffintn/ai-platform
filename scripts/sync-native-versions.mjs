#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findReleaseApp, readAppVersion } from "./lib/release-apps.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function rewrite(relativePath, transform) {
  const file = join(repositoryRoot, relativePath);
  const before = readFileSync(file, "utf8");
  const after = transform(before);

  if (after === before) {
    return false;
  }

  writeFileSync(file, after);

  return true;
}

function replaceRequired(source, pattern, replacement, description) {
  const matches = source.match(pattern);

  if (!matches) {
    throw new Error(`Could not find ${description}.`);
  }

  return source.replace(pattern, replacement);
}

function syncDesktop() {
  const version = readAppVersion(repositoryRoot, findReleaseApp("desktop"));
  const changed = [];

  if (
    rewrite("apps/desktop/src-tauri/tauri.conf.json", (source) =>
      replaceRequired(
        source,
        /^(  "version": ").*(",)$/m,
        `$1${version}$2`,
        "the top-level version in tauri.conf.json",
      ),
    )
  ) {
    changed.push("apps/desktop/src-tauri/tauri.conf.json");
  }

  if (
    rewrite("apps/desktop/src-tauri/Cargo.toml", (source) =>
      replaceRequired(
        source,
        /^version = ".*"$/m,
        `version = "${version}"`,
        "the package version in Cargo.toml",
      ),
    )
  ) {
    changed.push("apps/desktop/src-tauri/Cargo.toml");
  }

  if (
    rewrite("apps/desktop/src-tauri/Cargo.lock", (source) =>
      replaceRequired(
        source,
        /(name = "polychat-desktop"\nversion = ").*(")/,
        `$1${version}$2`,
        "the polychat-desktop entry in Cargo.lock",
      ),
    )
  ) {
    changed.push("apps/desktop/src-tauri/Cargo.lock");
  }

  return { version, changed };
}

function syncMobile() {
  const version = readAppVersion(repositoryRoot, findReleaseApp("ios"));
  const changed = [];

  if (
    rewrite("apps/mobile/ios/Polychat.xcodeproj/project.pbxproj", (source) =>
      replaceRequired(
        source,
        /MARKETING_VERSION = .*;/g,
        `MARKETING_VERSION = ${version};`,
        "MARKETING_VERSION in the Xcode project",
      ),
    )
  ) {
    changed.push("apps/mobile/ios/Polychat.xcodeproj/project.pbxproj");
  }

  return { version, changed };
}

function report(application, result) {
  const summary = result.changed.length === 0 ? "already in step" : result.changed.join(", ");

  process.stdout.write(`${application} ${result.version}: ${summary}\n`);
}

report("desktop", syncDesktop());
report("ios", syncMobile());

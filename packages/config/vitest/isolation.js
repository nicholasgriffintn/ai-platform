import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const TEST_FILE_PATTERN = /\.test\.[cm]?[jt]sx?$/;

const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "build", ".wrangler", "coverage"]);

const MODULE_REGISTRY_MUTATORS = [
  "vi.mock(",
  "vi.doMock(",
  "vi.unmock(",
  "vi.doUnmock(",
  "vi.spyOn(",
  "vi.stubGlobal(",
  "vi.stubEnv(",
  "useFakeTimers(",
];

function listTestFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...listTestFiles(entryPath));
      }

      continue;
    }

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function mutatesSharedState(file) {
  const source = readFileSync(file, "utf8");

  return MODULE_REGISTRY_MUTATORS.some((mutator) => source.includes(mutator));
}

function comparePaths(left, right) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

export function splitTestFilesByIsolation(projectRoot) {
  const isolated = [];
  const shared = [];

  for (const file of listTestFiles(projectRoot)) {
    const relative = path.relative(projectRoot, file).split(path.sep).join("/");

    (mutatesSharedState(file) ? isolated : shared).push(relative);
  }

  return { isolated: isolated.sort(comparePaths), shared: shared.sort(comparePaths) };
}

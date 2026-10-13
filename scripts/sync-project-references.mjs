#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const workspaceScope = "@ngriffin_uk/polychat-";
const skippedPackages = new Set(["config"]);

const sourceIncludes = ["src/**/*.ts", "src/**/*.tsx"];
const testIncludes = [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "src/**/*.spec.ts",
  "src/**/*.spec.tsx",
  "src/**/__test__/**/*",
  "src/**/__tests__/**/*",
  "src/test/**/*",
  "src/test-setup.ts",
];
const testFilePattern = /\.(test|spec)\.tsx?$/;
const testDirectoryNames = new Set(["__test__", "__tests__", "test"]);
const jsonImportPattern = /from\s+["'][^"']+\.json["']/;
const buildOnlyOptions = new Set([
  "composite",
  "emitDeclarationOnly",
  "noEmit",
  "outDir",
  "rootDir",
  "tsBuildInfoFile",
]);

const drift = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listDirectories(parent) {
  return fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parent, entry.name));
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    const file = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (visit(file, entry, true) === false) {
        return false;
      }

      if (!walk(file, visit)) {
        return false;
      }
    } else if (visit(file, entry, false) === false) {
      return false;
    }
  }

  return true;
}

function sourceDirectoryHas(sourceDir, predicate) {
  let found = false;

  walk(sourceDir, (file, entry, isDirectory) => {
    if (predicate(file, entry, isDirectory)) {
      found = true;

      return false;
    }

    return true;
  });

  return found;
}

function hasTestFiles(projectDir) {
  const sourceDir = path.join(projectDir, "src");
  const inSource = sourceDirectoryHas(sourceDir, (file, entry, isDirectory) =>
    isDirectory ? testDirectoryNames.has(entry.name) : testFilePattern.test(entry.name),
  );

  return inSource || fs.existsSync(path.join(projectDir, "test"));
}

function importsJson(projectDir) {
  return sourceDirectoryHas(
    path.join(projectDir, "src"),
    (file, entry, isDirectory) =>
      !isDirectory &&
      /\.tsx?$/.test(entry.name) &&
      jsonImportPattern.test(fs.readFileSync(file, "utf8")),
  );
}

function sortedReferences(fromDir, targets) {
  return targets
    .map((target) => path.relative(fromDir, target).split(path.sep).join("/"))
    .sort()
    .map((relative) => ({ path: relative }));
}

function workspaceDependencyDirs(pkg, packageDirs) {
  const names = new Set();

  for (const group of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
    for (const [name, version] of Object.entries(group ?? {})) {
      if (String(version).startsWith("workspace:") && packageDirs.has(name)) {
        names.add(name);
      }
    }
  }

  return [...names].map((name) => packageDirs.get(name));
}

function sharedOptions(current) {
  return Object.fromEntries(
    Object.entries(current.compilerOptions ?? {}).filter(([key]) => !buildOnlyOptions.has(key)),
  );
}

function syncJson(file, expected) {
  const relativeFile = path.relative(repoRoot, file);
  const actual = fs.existsSync(file) ? readJson(file) : undefined;

  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    return;
  }

  drift.push(relativeFile);
  if (!checkOnly) {
    fs.writeFileSync(file, `${JSON.stringify(expected, null, 2)}\n`);
  }
}

function removeFile(file) {
  if (!fs.existsSync(file)) {
    return;
  }

  drift.push(`${path.relative(repoRoot, file)} (remove)`);
  if (!checkOnly) {
    fs.rmSync(file);
  }
}

function packageProjects(packageDirs) {
  const projects = [];

  for (const dir of listDirectories(path.join(repoRoot, "packages"))) {
    const tsconfigFile = path.join(dir, "tsconfig.json");

    if (skippedPackages.has(path.basename(dir)) || !fs.existsSync(tsconfigFile)) {
      continue;
    }

    const pkg = readJson(path.join(dir, "package.json"));
    const current = readJson(tsconfigFile);
    const options = sharedOptions(current);
    const usesBundler = fs.existsSync(path.join(dir, "tsup.config.ts"));
    const references = sortedReferences(dir, workspaceDependencyDirs(pkg, packageDirs));
    const typecheckFile = path.join(dir, "tsconfig.typecheck.json");

    syncJson(tsconfigFile, {
      extends: current.extends,
      compilerOptions: {
        ...options,
        composite: true,
        outDir: "dist",
        rootDir: "src",
        tsBuildInfoFile: "dist/tsconfig.tsbuildinfo",
        ...(usesBundler ? { emitDeclarationOnly: true } : {}),
      },
      include: [...sourceIncludes, ...(importsJson(dir) ? ["src/**/*.json"] : [])],
      exclude: testIncludes,
      references,
    });
    projects.push(tsconfigFile);

    if (!hasTestFiles(dir)) {
      removeFile(typecheckFile);
      continue;
    }

    syncJson(typecheckFile, {
      extends: current.extends,
      compilerOptions: {
        ...options,
        composite: true,
        noEmit: true,
        tsBuildInfoFile: "node_modules/.tmp/tsconfig.typecheck.tsbuildinfo",
      },
      include: [
        ...testIncludes,
        "src/**/*.d.ts",
        ...(fs.existsSync(path.join(dir, "test")) ? ["test/**/*.ts"] : []),
      ],
      references: [{ path: "./tsconfig.json" }, ...references],
    });
    projects.push(typecheckFile);
  }

  return projects;
}

function appProjects(packageDirs) {
  const projects = [];

  for (const dir of listDirectories(path.join(repoRoot, "apps"))) {
    const candidates = ["tsconfig.cloudflare.json", "tsconfig.json"]
      .map((name) => path.join(dir, name))
      .filter((file) => fs.existsSync(file));

    if (candidates.length === 0) {
      continue;
    }

    const [projectFile] = candidates;
    const pkg = readJson(path.join(dir, "package.json"));
    const current = readJson(projectFile);

    syncJson(projectFile, {
      ...current,
      compilerOptions: { ...current.compilerOptions, composite: true, noEmit: true },
      references: sortedReferences(dir, workspaceDependencyDirs(pkg, packageDirs)),
    });
    projects.push(projectFile);
    const nodeProject = path.join(dir, "tsconfig.node.json");

    if (projectFile.endsWith("tsconfig.cloudflare.json") && fs.existsSync(nodeProject)) {
      projects.push(nodeProject);
    }
  }

  return projects;
}

function main() {
  const packageDirs = new Map();

  for (const dir of listDirectories(path.join(repoRoot, "packages"))) {
    const manifest = path.join(dir, "package.json");

    if (skippedPackages.has(path.basename(dir)) || !fs.existsSync(manifest)) {
      continue;
    }

    const { name } = readJson(manifest);

    if (name?.startsWith(workspaceScope)) {
      packageDirs.set(name, dir);
    }
  }

  const projects = [...packageProjects(packageDirs), ...appProjects(packageDirs)];

  syncJson(path.join(repoRoot, "tsconfig.json"), {
    files: [],
    references: sortedReferences(repoRoot, projects),
  });

  if (drift.length === 0) {
    console.log("Project references are in sync.");

    return;
  }

  const verb = checkOnly ? "out of sync" : "updated";

  console.log(`${drift.length} tsconfig file(s) ${verb}:`);
  for (const file of drift) {
    console.log(`  ${file}`);
  }

  if (checkOnly) {
    console.log("Run `pnpm sync:references` to regenerate them.");
    process.exitCode = 1;
  }
}

main();

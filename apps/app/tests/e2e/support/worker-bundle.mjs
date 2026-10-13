import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export function buildWorkerBundle(workspace, configPath, outputDirectory, repositoryRoot, logPath) {
  execFileSync(
    "pnpm",
    [
      "--filter",
      workspace,
      "exec",
      "wrangler",
      "deploy",
      "--dry-run",
      "--config",
      configPath,
      "--outdir",
      outputDirectory,
    ],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
      env: { ...process.env, WRANGLER_LOG_PATH: logPath },
    },
  );

  const outputNames = readdirSync(outputDirectory);
  const bundleName = outputNames.find((name) => name.endsWith(".js"));

  if (!bundleName) {
    throw new Error(`Wrangler did not produce a bundle for ${workspace}`);
  }

  const modules = [];

  for (const name of outputNames) {
    if (name.endsWith(".wasm")) {
      modules.push({
        type: "CompiledWasm",
        path: name,
        contents: readFileSync(path.join(outputDirectory, name)),
      });
    } else if (name.endsWith(".md") && name !== "README.md") {
      modules.push({
        type: "Text",
        path: name,
        contents: readFileSync(path.join(outputDirectory, name), "utf8"),
      });
    }
  }

  return { script: readFileSync(path.join(outputDirectory, bundleName), "utf8"), modules };
}

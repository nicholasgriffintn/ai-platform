import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  // 1. Run DB migrations (including seed migration)
  spawnSync("pnpm", ["db:migrate:local"], {
    cwd: path.join(__dirname, "apps/api"),
    stdio: "inherit",
  });

  // 2. Launch the API server
  const apiProcess: ChildProcess = spawn("pnpm", ["dev"], {
    cwd: path.join(__dirname, "apps/api"),
    stdio: "inherit",
  });

  // 3. Persist the API PID for teardown
  fs.writeFileSync(path.join(__dirname, "api.pid"), apiProcess.pid.toString());

  // 4. Wait for the API to be ready
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

export default globalSetup;

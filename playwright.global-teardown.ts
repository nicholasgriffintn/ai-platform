import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function globalTeardown(config: FullConfig) {
  // Read the stored PID
  const pidFile = path.resolve(__dirname, "api.pid");
  let pid: number;
  try {
    pid = Number.parseInt(readFileSync(pidFile, "utf-8"), 10);
  } catch (e) {
    console.warn("Global Teardown: no api.pid file found, skipping kill.");
    return;
  }

  // Kill the API process
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Global Teardown: killed API process ${pid}`);
  } catch (err: any) {
    console.warn(
      `Global Teardown: failed to kill process ${pid}:`,
      err.message,
    );
  }

  // Remove the PID file
  try {
    unlinkSync(pidFile);
  } catch {
    // ignore
  }
}

export default globalTeardown;

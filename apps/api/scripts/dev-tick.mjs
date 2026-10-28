#!/usr/bin/env node
import { spawn } from "node:child_process";

const PORT = process.env.POLYCHAT_DEV_PORT ?? "8787";
const TICK_MS = 3 * 60 * 1000;
const TICK_URL = `http://localhost:${PORT}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent("*/3 * * * *")}`;

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: dev-tick.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, { stdio: "inherit" });

async function tick() {
  const response = await fetch(TICK_URL).catch(() => null);

  if (response && !response.ok) {
    console.warn(`[dev-tick] background schedules answered ${response.status}`);
  }
}

const timer = setInterval(tick, TICK_MS);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  clearInterval(timer);
  process.exit(code ?? (signal ? 1 : 0));
});

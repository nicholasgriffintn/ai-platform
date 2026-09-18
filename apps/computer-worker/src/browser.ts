import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";
import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";

import {
  DEBUGGER_PORT,
  DEBUGGER_WAIT_TIMEOUT_MS,
  NAVIGATE_TIMEOUT_MS,
  OBSERVE_TIMEOUT_MS,
  PAINT_BRIGHTNESS_THRESHOLD,
  SCREEN_PORT,
} from "./config/app";
import type { ComputerSandbox } from "./types";

const DEBUGGER_BASE_URL = `http://127.0.0.1:${DEBUGGER_PORT}`;
const PROCESS_PIDFILES = ["chromium", "websockify", "x11vnc", "openbox", "xvfb"] as const;

function timeoutError(op: string): Error {
  return new Error(`${op} timed out`);
}

async function withTimeout<T>(op: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(op)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function quoteShellArg(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function waitForBrowserDebugger(sandbox: ComputerSandbox): Promise<void> {
  const deadline = Date.now() + DEBUGGER_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await sandbox
      .exec(
        `curl -s -m 2 ${DEBUGGER_BASE_URL}/json/list 2>/dev/null | grep -q '"type"[[:space:]]*:[[:space:]]*"page"'`,
      )
      .catch(() => null);

    if (result?.success) {
      return;
    }

    await sandbox.exec("sleep 0.5").catch(() => null);
  }

  throw timeoutError("debugger wait");
}

async function assertComputerHealthy(sandbox: ComputerSandbox): Promise<void> {
  const result = await sandbox.exec("/usr/local/bin/health-probe").catch(() => null);

  if (!result?.success) {
    throw new Error("Computer display did not start");
  }
}

async function stopProcessesByPidfile(sandbox: ComputerSandbox): Promise<void> {
  const names = PROCESS_PIDFILES.join(" ");

  await sandbox
    .exec(
      [
        "for pf in " + names + "; do",
        '  pid=$(cat /tmp/computer/$pf.pid 2>/dev/null || echo "")',
        '  [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null || true',
        "done",
        "for _ in 1 2 3 4 5; do",
        "  alive=0",
        "  for pf in " + names + "; do",
        '    pid=$(cat /tmp/computer/$pf.pid 2>/dev/null || echo "")',
        '    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then alive=1; fi',
        "  done",
        '  [ "$alive" = 0 ] && break',
        "  sleep 1",
        "done",
        "for pf in " + names + "; do",
        '  pid=$(cat /tmp/computer/$pf.pid 2>/dev/null || echo "")',
        '  [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null || true',
        "done",
      ].join("; "),
      { timeout: 15_000 },
    )
    .catch(() => null);
}

async function capturePaintScore(sandbox: ComputerSandbox): Promise<number | null> {
  const shot = await sandbox
    .exec("DISPLAY=:99 scrot -o /tmp/computer-screen.png", { timeout: 5_000 })
    .catch(() => null);

  if (!shot?.success) {
    return null;
  }

  const scored = await sandbox.exec("python3 /usr/local/bin/check-paint /tmp/computer-screen.png", {
    timeout: 10_000,
  });

  if (!scored.success) {
    return null;
  }

  const score = Number.parseFloat(scored.stdout.trim());

  return Number.isFinite(score) ? score : null;
}

async function readScreenshot(sandbox: ComputerSandbox): Promise<string | null> {
  const screenshot = await sandbox
    .readFile("/tmp/computer-screen.png", { encoding: "base64" })
    .catch(() => null);

  if (!screenshot) {
    return null;
  }

  return `data:image/png;base64,${screenshot.content}`;
}

async function navigateBrowser(sandbox: ComputerSandbox, rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);

  if (url.protocol !== "https:" || isPrivateHostname(url.hostname)) {
    throw new Error("Only public HTTPS browser destinations are allowed");
  }

  let result: { success: boolean; stderr: string; stdout: string };

  try {
    result = await sandbox.exec(
      `python3 /usr/local/bin/navigate ${quoteShellArg(url.toString())}`,
      {
        timeout: NAVIGATE_TIMEOUT_MS,
      },
    );
  } catch {
    throw timeoutError("navigate");
  }

  if (!result.success) {
    throw new Error(result.stderr || "Computer browser could not navigate");
  }
}

export async function startComputer(sandbox: ComputerSandbox): Promise<void> {
  const running = await sandbox.exec("pgrep -f '[w]ebsockify.*6080' >/dev/null");

  if (running.success) {
    return;
  }

  await stopComputer(sandbox);

  let lastError = "Computer display did not start";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const process = await sandbox.startProcess("start-computer");

      await process.waitForPort(SCREEN_PORT, { mode: "tcp", timeout: 30_000 });
      await waitForBrowserDebugger(sandbox);
      await assertComputerHealthy(sandbox);

      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      await stopComputer(sandbox).catch(() => null);
    }
  }

  throw new Error(lastError);
}

export async function stopComputer(sandbox: ComputerSandbox): Promise<void> {
  await stopProcessesByPidfile(sandbox);
  await sandbox
    .exec("rm -f /tmp/.X99-lock; rm -f /tmp/.X11-unix/X99; rm -f /workspace/profile/Singleton*", {
      timeout: 5_000,
    })
    .catch(() => null);
}

export async function stopScreenServer(sandbox: ComputerSandbox): Promise<void> {
  await sandbox.exec("pkill -f '[w]ebsockify.*6080' || true").catch(() => null);
}

export async function observeComputer(sandbox: ComputerSandbox): Promise<Record<string, unknown>> {
  await startComputer(sandbox);

  const score = await capturePaintScore(sandbox);

  if (score === null || score < PAINT_BRIGHTNESS_THRESHOLD) {
    await stopComputer(sandbox).catch(() => null);
    await startComputer(sandbox);
    await capturePaintScore(sandbox);
  }

  return withTimeout("observe", OBSERVE_TIMEOUT_MS, readObservation(sandbox));
}

async function readObservation(sandbox: ComputerSandbox): Promise<Record<string, unknown>> {
  const titleResult = await sandbox
    .exec("DISPLAY=:99 xdotool getactivewindow getwindowname", { timeout: 5_000 })
    .catch(() => null);
  const title =
    titleResult?.success && titleResult.stdout.trim()
      ? titleResult.stdout.trim()
      : "Hosted computer";
  const screenshot = await readScreenshot(sandbox);

  return {
    title,
    screenshot,
    width: 1440,
    height: 900,
  };
}

async function readBrowserPage(sandbox: ComputerSandbox): Promise<Record<string, unknown>> {
  const result = await sandbox
    .exec("python3 /usr/local/bin/read-page", { timeout: 15_000 })
    .catch(() => null);

  if (!result?.success) {
    throw new Error(result?.stderr || "Could not read the page");
  }

  const parsed = JSON.parse(result.stdout) as { title?: string; text?: string; error?: string };

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return { title: parsed.title || "Hosted computer", text: parsed.text ?? "" };
}

export async function inputComputer(
  sandbox: ComputerSandbox,
  input: TeammateComputerInput,
): Promise<Record<string, unknown>> {
  await startComputer(sandbox);

  if (input.type === "navigate") {
    await navigateBrowser(sandbox, input.url);

    return observeComputer(sandbox);
  }

  if (input.type === "read") {
    return readBrowserPage(sandbox);
  }

  let command: string;
  let env: Record<string, string> | undefined;

  switch (input.type) {
    case "click": {
      const button = { left: 1, middle: 2, right: 3 }[input.button];

      command = `DISPLAY=:99 xdotool mousemove ${input.x} ${input.y} click ${button}`;
      break;
    }

    case "type":
      command = 'DISPLAY=:99 xdotool type --clearmodifiers -- "$COMPUTER_TEXT"';
      env = { COMPUTER_TEXT: input.text };
      break;

    case "key":
      command = `DISPLAY=:99 xdotool key --clearmodifiers ${input.key}`;
      break;

    case "scroll": {
      const button = { up: 4, down: 5, left: 6, right: 7 }[input.direction];

      command = `DISPLAY=:99 xdotool click --repeat ${input.amount} --delay 50 ${button}`;
      break;
    }

    case "wait":
      command = `sleep ${input.durationMs / 1000}`;
      break;
  }

  const result = await sandbox.exec(command, { env, timeout: 15_000 });

  if (!result.success) {
    throw new Error(result.stderr || "Could not control the computer");
  }

  return observeComputer(sandbox);
}

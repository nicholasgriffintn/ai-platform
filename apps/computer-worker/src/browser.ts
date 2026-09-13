import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";
import { isPrivateHostname, isRecord } from "@ngriffin_uk/polychat-utility-core";

import { DEBUGGER_PORT, PAINT_BRIGHTNESS_THRESHOLD, SCREEN_PORT } from "./constants";
import type { ComputerSandbox } from "./types";

const DEBUGGER_BASE_URL = `http://127.0.0.1:${DEBUGGER_PORT}`;

interface DebuggerTarget {
  id: string;
  type: string;
  title: string;
  url: string;
}

async function debuggerRequest<T>(
  sandbox: ComputerSandbox,
  path: string,
  method: "GET" | "PUT" = "GET",
): Promise<T> {
  const result = await sandbox.exec(`curl -s -m 10 -X ${method} '${DEBUGGER_BASE_URL}${path}'`, {
    timeout: 15_000,
  });

  if (!result.success) {
    throw new Error("Computer browser is not responding");
  }

  return JSON.parse(result.stdout) as T;
}

async function listDebuggerTargets(sandbox: ComputerSandbox): Promise<DebuggerTarget[]> {
  const targets = await debuggerRequest<unknown>(sandbox, "/json/list");

  if (!Array.isArray(targets)) {
    return [];
  }

  return targets.flatMap((target) => {
    if (!isRecord(target) || typeof target.id !== "string") {
      return [];
    }

    return [
      {
        id: target.id,
        type: typeof target.type === "string" ? target.type : "",
        title: typeof target.title === "string" ? target.title : "",
        url: typeof target.url === "string" ? target.url : "",
      },
    ];
  });
}

async function waitForBrowserDebugger(sandbox: ComputerSandbox): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const targets = await listDebuggerTargets(sandbox).catch(() => null);

    if (targets?.some((target) => target.type === "page")) {
      return;
    }

    await sandbox.exec("sleep 0.5").catch(() => null);
  }

  throw new Error(
    "Computer browser did not start (debugger unreachable — restart the worker to rebuild the container image)",
  );
}

async function waitForPageLoad(sandbox: ComputerSandbox, targetId: string): Promise<void> {
  let stableTitle: string | null = null;
  let stableCount = 0;
  let missingCount = 0;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const targets = await listDebuggerTargets(sandbox).catch(() => []);
    const target = targets.find((candidate) => candidate.id === targetId);

    if (!target) {
      missingCount += 1;

      if (missingCount >= 5) {
        throw new Error("Computer browser closed the page");
      }
    } else {
      missingCount = 0;
      const title = target.title.trim();

      if (title && title === stableTitle) {
        stableCount += 1;

        if (stableCount >= 3 && attempt >= 4) {
          return;
        }
      } else {
        stableTitle = title || null;
        stableCount = title ? 1 : 0;
      }
    }

    await sandbox.exec("sleep 0.5").catch(() => null);
  }
}

async function navigateBrowser(sandbox: ComputerSandbox, rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);

  if (url.protocol !== "https:" || isPrivateHostname(url.hostname)) {
    throw new Error("Only public HTTPS browser destinations are allowed");
  }

  const created = await debuggerRequest<DebuggerTarget>(
    sandbox,
    `/json/new?${encodeURIComponent(url.toString())}`,
    "PUT",
  );

  if (!created || typeof created.id !== "string") {
    throw new Error("Computer browser did not open the destination");
  }

  const targets = await listDebuggerTargets(sandbox).catch(() => []);

  for (const target of targets) {
    if (target.type === "page" && target.id !== created.id) {
      await debuggerRequest(sandbox, `/json/close/${target.id}`).catch(() => null);
    }
  }

  await waitForPageLoad(sandbox, created.id);
  await waitForPaint(sandbox, 30);
}

async function capturePaintScore(sandbox: ComputerSandbox): Promise<number | null> {
  const shot = await sandbox
    .exec("DISPLAY=:99 scrot -o /tmp/computer-screen.png")
    .catch(() => null);

  if (!shot?.success) {
    return null;
  }

  const scored = await sandbox.exec("python3 /usr/local/bin/check-paint /tmp/computer-screen.png", {
    timeout: 15_000,
  });

  if (!scored.success) {
    return null;
  }

  const score = Number.parseFloat(scored.stdout.trim());

  return Number.isFinite(score) ? score : null;
}

async function waitForPaint(sandbox: ComputerSandbox, attempts: number): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const score = await capturePaintScore(sandbox);

    if (score !== null && score >= PAINT_BRIGHTNESS_THRESHOLD) {
      return true;
    }

    await sandbox.exec("sleep 0.5").catch(() => null);
  }

  return false;
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
      await sandbox
        .exec(
          "for i in 1 2 3 4 5 6 7 8 9 10; do DISPLAY=:99 xdotool getmouselocation >/dev/null 2>&1 && break; sleep 0.5; done; true",
          { timeout: 10_000 },
        )
        .catch(() => null);
      await waitForBrowserDebugger(sandbox);

      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      await stopComputer(sandbox).catch(() => null);
    }
  }

  throw new Error(lastError);
}

export async function stopComputer(sandbox: ComputerSandbox): Promise<void> {
  await sandbox.exec(
    "pkill -x chrome || true; pkill -x chromium || true; pkill -f 'remote-debugging-port=9222' || true; pkill -f '[w]ebsockify.*6080' || true; pkill -x x11vnc || true; pkill -x Xvfb || true; pkill -x openbox || true",
  );
  await sandbox.exec("sleep 1").catch(() => null);
  await sandbox.exec(
    "rm -f /tmp/.X99-lock; rm -f /tmp/.X11-unix/X99; rm -f /workspace/profile/Singleton*",
  );
}

export async function stopScreenServer(sandbox: ComputerSandbox): Promise<void> {
  await sandbox.exec("pkill -f '[w]ebsockify.*6080' || true");
}

export async function observeComputer(sandbox: ComputerSandbox): Promise<Record<string, unknown>> {
  await startComputer(sandbox);

  let score: number | null = null;

  for (let attempt = 0; attempt < 5 && score === null; attempt += 1) {
    score = await capturePaintScore(sandbox);

    if (score === null) {
      await sandbox.exec("sleep 0.5").catch(() => null);
    }
  }

  if (score !== null && score < PAINT_BRIGHTNESS_THRESHOLD) {
    await stopComputer(sandbox).catch(() => null);
    await startComputer(sandbox);
    await sandbox.exec("rm -f /tmp/computer-screen.png").catch(() => null);
    score = await capturePaintScore(sandbox);
  }

  if (score === null) {
    throw new Error("Could not observe the computer");
  }

  const titleResult = await sandbox.exec("DISPLAY=:99 xdotool getactivewindow getwindowname");
  const title =
    titleResult.success && titleResult.stdout.trim()
      ? titleResult.stdout.trim()
      : "Hosted computer";
  const screenshot = await sandbox.readFile("/tmp/computer-screen.png", {
    encoding: "base64",
  });

  return {
    title,
    screenshot: `data:image/png;base64,${screenshot.content}`,
    width: 1440,
    height: 900,
  };
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

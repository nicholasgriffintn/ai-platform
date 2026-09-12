import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";
import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";

import { SCREEN_PORT } from "./constants";
import type { ComputerSandbox } from "./types";

export async function startComputer(sandbox: ComputerSandbox): Promise<void> {
  const running = await sandbox.exec("pgrep -f '[w]ebsockify.*6080' >/dev/null");

  if (running.success) {
    return;
  }

  await stopComputer(sandbox);
  const process = await sandbox.startProcess("start-computer");

  await process.waitForPort(SCREEN_PORT, { mode: "tcp", timeout: 30_000 });
}

export async function stopComputer(sandbox: ComputerSandbox): Promise<void> {
  await sandbox.exec(
    "pkill -x chromium || true; pkill -f '[w]ebsockify.*6080' || true; pkill -x x11vnc || true; pkill -x Xvfb || true; pkill -x openbox || true",
  );
}

export async function stopScreenServer(sandbox: ComputerSandbox): Promise<void> {
  await sandbox.exec("pkill -f '[w]ebsockify.*6080' || true");
}

export async function observeComputer(sandbox: ComputerSandbox): Promise<Record<string, unknown>> {
  await startComputer(sandbox);
  const result = await sandbox.exec(
    "DISPLAY=:99 scrot -o /tmp/computer-screen.png && DISPLAY=:99 xdotool getactivewindow getwindowname",
  );

  if (!result.success) {
    throw new Error(result.stderr || "Could not observe the computer");
  }

  const screenshot = await sandbox.readFile("/tmp/computer-screen.png", { encoding: "base64" });

  return {
    title: result.stdout.trim(),
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
  let command: string;
  let env: Record<string, string> | undefined;

  switch (input.type) {
    case "navigate": {
      const url = new URL(input.url);

      if (url.protocol !== "https:" || isPrivateHostname(url.hostname)) {
        throw new Error("Only public HTTPS browser destinations are allowed");
      }

      command =
        'DISPLAY=:99 xdotool key --clearmodifiers ctrl+l && DISPLAY=:99 xdotool type --clearmodifiers -- "$COMPUTER_URL" && DISPLAY=:99 xdotool key Return';
      env = { COMPUTER_URL: url.toString() };
      break;
    }

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

import { createLeaseFence, type LeaseFence } from "@ngriffin_uk/polychat-library-sandbox";

import { FENCE_FILE } from "./constants";
import type { ComputerSandbox } from "./types";

async function readStoredFence(sandbox: ComputerSandbox): Promise<number | null> {
  const result = await sandbox.exec(`cat ${FENCE_FILE} 2>/dev/null || echo 0`).catch(() => null);
  const current = result && result.success ? Number.parseInt(result.stdout.trim(), 10) : Number.NaN;

  return Number.isFinite(current) ? current : null;
}

async function writeStoredFence(sandbox: ComputerSandbox, fence: number): Promise<void> {
  await sandbox.exec("mkdir -p /workspace").catch(() => null);
  await sandbox.writeFile(FENCE_FILE, String(fence));
}

export function computerLeaseFence(sandbox: ComputerSandbox): LeaseFence {
  return createLeaseFence({
    read: () => readStoredFence(sandbox),
    write: (fence) => writeStoredFence(sandbox, fence),
  });
}

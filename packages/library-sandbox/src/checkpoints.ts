import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export interface SandboxCheckpointReference {
  id: string;
  dir: string;
  localBucket?: boolean;
}

export function parseSandboxCheckpointReference(value: string): SandboxCheckpointReference {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Checkpoint reference is invalid");
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.id !== "string" ||
    !parsed.id ||
    typeof parsed.dir !== "string" ||
    !parsed.dir ||
    (parsed.localBucket !== undefined && typeof parsed.localBucket !== "boolean")
  ) {
    throw new Error("Checkpoint reference is invalid");
  }

  return {
    id: parsed.id,
    dir: parsed.dir,
    ...(typeof parsed.localBucket === "boolean" ? { localBucket: parsed.localBucket } : {}),
  };
}

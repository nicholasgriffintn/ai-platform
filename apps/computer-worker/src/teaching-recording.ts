import {
  teammateComputerTeachingRecordingSchema,
  teachingRecordingIdSchema,
  type TeammateComputerTeachingRecording,
} from "@ngriffin_uk/polychat-schemas";

import type { ComputerSandbox } from "./types";

const KEY_EVENT = 4;
const POINTER_EVENT = 5;

function recordingPath(recordingId: string): string {
  return `/tmp/${recordingId}.json`;
}

async function writeTeachingRecording(
  sandbox: ComputerSandbox,
  recording: TeammateComputerTeachingRecording,
): Promise<void> {
  await sandbox.writeFile(recordingPath(recording.id), JSON.stringify(recording));
}

export async function startTeachingRecording(
  sandbox: ComputerSandbox,
  recordingId: string,
): Promise<void> {
  const id = teachingRecordingIdSchema.parse(recordingId);

  await writeTeachingRecording(sandbox, {
    id,
    startedAt: new Date().toISOString(),
    pointerActions: 0,
    keyActions: 0,
    totalActions: 0,
    actions: [],
  });
}

export async function readTeachingRecording(
  sandbox: ComputerSandbox,
  recordingId: string,
): Promise<TeammateComputerTeachingRecording | null> {
  const id = teachingRecordingIdSchema.parse(recordingId);
  const file = await sandbox.readFile(recordingPath(id), { encoding: "utf-8" }).catch(() => null);

  if (!file) {
    return null;
  }

  const value: unknown = JSON.parse(file.content);
  const parsed = teammateComputerTeachingRecordingSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function createTeachingFrameRecorder(
  sandbox: ComputerSandbox,
  recordingId: string,
): (data: string | ArrayBuffer) => Promise<void> {
  let recording = readTeachingRecording(sandbox, recordingId);
  let pointerMask = 0;

  return async (data) => {
    if (typeof data === "string") {
      return;
    }

    const bytes = new Uint8Array(data);
    const eventType = bytes[0];
    const current = await recording;

    if (!current) {
      return;
    }

    if (eventType === KEY_EVENT && bytes[1] === 1) {
      current.keyActions += 1;

      if (current.actions.length < 500) {
        current.actions.push("keyboard");
      }
    } else if (eventType === POINTER_EVENT) {
      const nextPointerMask = bytes[1] ?? 0;

      if (nextPointerMask !== 0 && nextPointerMask !== pointerMask) {
        current.pointerActions += 1;

        if (current.actions.length < 500) {
          current.actions.push("pointer");
        }
      }

      pointerMask = nextPointerMask;
    } else {
      return;
    }

    current.totalActions = current.keyActions + current.pointerActions;
    recording = writeTeachingRecording(sandbox, current).then(() => current);
    await recording;
  };
}

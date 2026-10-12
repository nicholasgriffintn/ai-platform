import {
  teammateComputerTeachingRecordingSchema,
  teachingRecordingIdSchema,
  type TeammateComputerTeachingRecording,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import type { ComputerSandbox } from "./types";

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
  const content = await sandbox.readFile(recordingPath(id)).catch(() => null);

  if (!content) {
    return null;
  }

  const parsed = teammateComputerTeachingRecordingSchema.safeParse(safeParseJson(content));

  return parsed.success ? parsed.data : null;
}

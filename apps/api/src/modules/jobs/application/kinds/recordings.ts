import { handleRecordingGenerateImage } from "~/modules/experiences/application/recordings/generate-image";
import { handleRecordingSummarise } from "~/modules/experiences/application/recordings/summarise";
import { handleRecordingTranscribe } from "~/modules/experiences/application/recordings/transcribe";

import type { JobKindDefinition } from "../../domain/job-kind";
import { requireLatestScopedOutput } from "../outputs";
import { outputJobFields } from "../present";

const RECORDINGS_CAPABILITY = "recordings";
const RECORDINGS_PROJECT_CAPABILITY = "featured-recording-processor";

export const recordingTranscriptionJobs: JobKindDefinition<"recording_transcription"> = {
  kind: "recording_transcription",
  outputCapability: RECORDINGS_CAPABILITY,
  projectCapability: RECORDINGS_PROJECT_CAPABILITY,
  requiredPlan: "pro",
  async start(scope, input) {
    await handleRecordingTranscribe({
      context: scope.context,
      request: input,
      user: scope.user,
      projectId: scope.projectId,
    });
    const record = await requireLatestScopedOutput(
      scope,
      RECORDINGS_CAPABILITY,
      input.recordingId,
      "transcribe",
    );
    const job = recordingTranscriptionJobs.present(record);

    return { jobs: job ? [job] : [], rejected: [] };
  },
  present(record) {
    return record.capability_id === RECORDINGS_CAPABILITY && record.kind === "transcribe"
      ? { ...outputJobFields(record), kind: "recording_transcription" }
      : null;
  },
};

export const recordingSummaryJobs: JobKindDefinition<"recording_summary"> = {
  kind: "recording_summary",
  outputCapability: RECORDINGS_CAPABILITY,
  projectCapability: RECORDINGS_PROJECT_CAPABILITY,
  requiredPlan: "pro",
  async start(scope, input) {
    await handleRecordingSummarise({
      context: scope.context,
      request: input,
      user: scope.user,
      projectId: scope.projectId,
    });
    const record = await requireLatestScopedOutput(
      scope,
      RECORDINGS_CAPABILITY,
      input.recordingId,
      "summary",
    );
    const job = recordingSummaryJobs.present(record);

    return { jobs: job ? [job] : [], rejected: [] };
  },
  present(record) {
    return record.capability_id === RECORDINGS_CAPABILITY && record.kind === "summary"
      ? { ...outputJobFields(record), kind: "recording_summary" }
      : null;
  },
};

export const recordingImageJobs: JobKindDefinition<"recording_image"> = {
  kind: "recording_image",
  outputCapability: RECORDINGS_CAPABILITY,
  projectCapability: RECORDINGS_PROJECT_CAPABILITY,
  requiredPlan: "pro",
  async start(scope, input) {
    await handleRecordingGenerateImage({
      context: scope.context,
      request: input,
      user: scope.user,
      projectId: scope.projectId,
    });
    const record = await requireLatestScopedOutput(
      scope,
      RECORDINGS_CAPABILITY,
      input.recordingId,
      "image",
    );
    const job = recordingImageJobs.present(record);

    return { jobs: job ? [job] : [], rejected: [] };
  },
  present(record) {
    return record.capability_id === RECORDINGS_CAPABILITY && record.kind === "image"
      ? { ...outputJobFields(record), kind: "recording_image" }
      : null;
  },
};

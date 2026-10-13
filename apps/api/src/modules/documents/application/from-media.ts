import {
  buildDocumentNotesPrompt,
  getPromptText,
  tryGetPrompt,
} from "@ngriffin_uk/polychat-ai-prompts";
import type { TranscriptionResult } from "@ngriffin_uk/polychat-schemas";
import {
  buildCaptionCues,
  formatTimedTranscript,
  type TimedSegment,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { TranscriptionProvider } from "~/modules/audio/application/transcribe";
import { handleTranscribe } from "~/modules/audio/application/transcribe";
import { resolveAuthorisedTranscriptionSource } from "~/modules/audio/application/transcription-input";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import type { IUser } from "~/types";

const TIMED_LINE_OPTIONS = { maxWords: 60, maxSeconds: 30, minWordsBeforeSentenceBreak: 20 };

function readTimedLines(transcription: TranscriptionResult): TimedSegment[] {
  if (transcription.segments?.length) {
    return transcription.segments;
  }

  return transcription.words?.length
    ? buildCaptionCues(transcription.words, TIMED_LINE_OPTIONS)
    : [];
}

export async function generateDocumentFromMedia({
  context,
  user,
  url,
  outputs,
  documentType,
  extraPrompt,
  timestamps,
}: {
  context: ServiceContext;
  user: IUser;
  url: string;
  outputs: (
    | "concise_summary"
    | "detailed_outline"
    | "key_takeaways"
    | "action_items"
    | "meeting_minutes"
    | "qa_extraction"
    | "smart_timestamps"
  )[];
  documentType: string;
  extraPrompt?: string;
  timestamps?: boolean;
}): Promise<{ content: string }> {
  const env = context.env;

  if (!url) {
    throw new AssistantError("Missing media URL", ErrorType.PARAMS_ERROR);
  }

  const wantsTimings = timestamps === true || outputs.includes("smart_timestamps");

  try {
    const toPromptSegment = (value: string) => value.replace(/_/g, "-");
    const selectedSections = outputs.map(
      (output) => tryGetPrompt(`document/section/${toPromptSegment(output)}`)?.text ?? output,
    );
    const documentTypeDescriptor =
      tryGetPrompt(`document/type/${toPromptSegment(documentType)}`)?.text ??
      getPromptText("document/type/other");

    const notePrompt = buildDocumentNotesPrompt({
      documentTypeDescriptor,
      sections: selectedSections,
      timestamps: wantsTimings,
      extraPrompt,
    });

    const audio = await resolveAuthorisedTranscriptionSource({
      context,
      url,
      userId: user.id,
    });

    const TWENTY_MB = 20 * 1024 * 1024;

    let transcriptionProviderToUse: TranscriptionProvider;

    if (audio.file.size <= TWENTY_MB) {
      transcriptionProviderToUse = "mistral";
    } else {
      transcriptionProviderToUse = "replicate";
    }

    if (!transcriptionProviderToUse) {
      throw new AssistantError("No transcription provider was determined", ErrorType.PARAMS_ERROR);
    }

    const transcription = await handleTranscribe({
      env,
      user,
      audio,
      allowVideo: true,
      provider: transcriptionProviderToUse,
      timestamps: wantsTimings,
    });

    let transcriptText = transcription.content;

    if (wantsTimings) {
      const timedLines = readTimedLines(transcription);

      if (timedLines.length === 0) {
        throw new AssistantError(
          "The transcription came back without timings, so timestamps cannot be added. Turn timestamps off and try again.",
          ErrorType.EXTERNAL_API_ERROR,
          502,
        );
      }

      transcriptText = formatTimedTranscript(timedLines);
    }

    if (!transcriptText) {
      throw new AssistantError("Empty transcript returned", ErrorType.EXTERNAL_API_ERROR);
    }

    const {
      model: modelToUse,
      provider: providerToUse,
      effort,
    } = await getAuxiliaryModel(env, user);

    const userPrompt = `${extraPrompt ? `${extraPrompt}\n\n` : ""}Transcript:\n\n${transcriptText}`;
    const content = await ai.generateText({
      env,
      user,
      model: modelToUse,
      provider: providerToUse,
      system: notePrompt,
      prompt: userPrompt,
      reasoning_effort: effort,
      disable_functions: true,
    });

    if (!content) {
      throw new AssistantError("Empty notes returned", ErrorType.EXTERNAL_API_ERROR);
    }

    return { content };
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }

    throw new AssistantError(
      `Failed to generate notes: ${error instanceof Error ? error.message : "Unknown error"}`,
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

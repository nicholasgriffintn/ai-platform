import {
  buildDocumentNotesPrompt,
  getPromptText,
  tryGetPrompt,
} from "@ngriffin_uk/polychat-ai-prompts";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { TranscriptionProvider } from "~/modules/audio/application/transcribe";
import { handleTranscribe } from "~/modules/audio/application/transcribe";
import { resolveAuthorisedTranscriptionSource } from "~/modules/audio/application/transcription-input";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import type { IUser } from "~/types";

export async function generateDocumentFromMedia({
  context,
  user,
  url,
  outputs,
  documentType,
  extraPrompt,
  timestamps,
  useVideoAnalysis = false,
  enableVideoSearch = false,
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
    | "scene_analysis"
    | "visual_insights"
    | "smart_timestamps"
  )[];
  documentType: string;
  extraPrompt?: string;
  timestamps?: boolean;
  useVideoAnalysis?: boolean;
  enableVideoSearch?: boolean;
  projectId?: string;
}): Promise<{ content: string }> {
  const env = context.env;

  if (!url) {
    throw new AssistantError("Missing media URL", ErrorType.PARAMS_ERROR);
  }

  if (enableVideoSearch) {
    throw new AssistantError(
      "Multimodal video search is not available while its retrieval index is being upgraded",
      ErrorType.CONFIGURATION_ERROR,
      501,
    );
  }

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
      useVideoAnalysis,
      timestamps,
      extraPrompt,
    });

    if (useVideoAnalysis) {
      throw new AssistantError(
        "Video analysis by remote URL is disabled",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    let transcriptText = "";

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
      timestamps,
    });

    transcriptText = transcription.content;

    if (!transcriptText) {
      throw new AssistantError("Empty transcript returned", ErrorType.EXTERNAL_API_ERROR);
    }

    const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(env, user);

    const userPrompt = `${extraPrompt ? `${extraPrompt}\n\n` : ""}Transcript:\n\n${transcriptText}`;
    const content = await ai.generateText({
      env,
      user,
      model: modelToUse,
      provider: providerToUse,
      system: notePrompt,
      prompt: userPrompt,
      reasoning: { effort: "none" },
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

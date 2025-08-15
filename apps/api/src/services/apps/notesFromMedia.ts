import {
  handleTranscribe,
  TranscriptionProvider,
} from "~/services/audio/transcribe";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getAuxiliaryModel } from "~/lib/models";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function generateNotesFromMedia({
  env,
  user,
  url,
  outputs,
  noteType,
  extraPrompt,
  timestamps,
}: {
  env: IEnv;
  user: IUser;
  url: string;
  outputs: (
    | "concise_summary"
    | "detailed_outline"
    | "key_takeaways"
    | "action_items"
    | "meeting_minutes"
    | "qa_extraction"
  )[];
  noteType: string;
  extraPrompt?: string;
  timestamps?: boolean;
}): Promise<{ content: string }> {
  if (!url) {
    throw new AssistantError("Missing media URL", ErrorType.PARAMS_ERROR);
  }

  try {
    let contentLengthBytes = 0;
    try {
      const head = await fetch(url, { method: "HEAD" });
      const len = head.headers.get("content-length");
      contentLengthBytes = len ? Number(len) : 0;
    } catch {
      // Do nothing
    }

    const TWENTY_MB = 20 * 1024 * 1024;

    let transcriptionProviderToUse: TranscriptionProvider = "workers";
    let transcriptText = "";

    if (contentLengthBytes > 0 && contentLengthBytes <= TWENTY_MB) {
      transcriptionProviderToUse = "mistral";
    } else if (contentLengthBytes > TWENTY_MB) {
      transcriptionProviderToUse = "replicate";
    }

    const transcription = await handleTranscribe({
      env,
      user,
      audio: url,
      provider: transcriptionProviderToUse,
      timestamps: !!timestamps,
    });

    const response = Array.isArray(transcription)
      ? transcription[0]
      : transcription;
    transcriptText =
      typeof response?.content === "string" ? response.content : "";

    if (!transcriptText) {
      throw new AssistantError(
        "Empty transcript returned",
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    const { model: modelToUse, provider: providerToUse } =
      await getAuxiliaryModel(env, user);
    const provider = AIProviderFactory.getProvider(providerToUse);

    const outputLabels: Record<string, string> = {
      concise_summary: "Concise Summary",
      detailed_outline: "Detailed Outline",
      key_takeaways: "Key Takeaways",
      action_items: "Action Items",
      meeting_minutes: "Meeting Minutes",
      qa_extraction: "Q&A Extraction",
    };

    const typeDescriptorMap: Record<string, string> = {
      general: "general content",
      meeting: "a meeting with multiple speakers",
      training: "a training session",
      lecture: "an academic lecture",
      interview: "an interview",
      podcast: "a podcast episode",
      webinar: "a webinar",
      tutorial: "an instructional tutorial",
      other: "content",
    };

    const selectedSections = outputs
      .map((o) => outputLabels[o] || o)
      .map((label) => `- ${label}`)
      .join("\n");

    const systemPrompt = `You are an expert note taker. Given a transcript from ${
      typeDescriptorMap[noteType] || "content"
    }, produce the following sections in Markdown. Use clear headings and bullet points where appropriate. Sections to include:\n${selectedSections}\n\nGuidelines:\n- Be accurate to the transcript while improving clarity\n- Keep factual details, names, dates\n- Merge duplicates and remove filler\n- Prefer concise language\n- For Action Items, include owner (if identifiable) and due dates if present\n- For Meeting Minutes, include attendees (if identifiable), agenda, decisions, and next steps\n- For Q&A Extraction, list Q paired with A succinctly\n`;

    const userPrompt = `${extraPrompt ? `${extraPrompt}\n\n` : ""}Transcript:\n\n${transcriptText}`;

    const aiResult = await provider.getResponse(
      {
        model: modelToUse,
        env,
        user,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      },
      user.id,
    );

    const content =
      (aiResult as any)?.response ||
      (Array.isArray((aiResult as any).choices) &&
        (aiResult as any).choices[0]?.message?.content) ||
      (typeof aiResult === "string"
        ? (aiResult as string)
        : JSON.stringify(aiResult));

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

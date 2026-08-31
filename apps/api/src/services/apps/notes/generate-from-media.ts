import type { ServiceContext } from "~/lib/context/serviceContext";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { TranscriptionProvider } from "~/services/audio/transcribe";
import { handleTranscribe } from "~/services/audio/transcribe";
import { resolveAuthorisedTranscriptionSource } from "~/services/audio/transcription-input";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function generateNotesFromMedia({
  context,
  user,
  url,
  outputs,
  noteType,
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
  noteType: string;
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
    const outputLabels: Record<string, string> = {
      concise_summary: "Concise Summary",
      detailed_outline: "Detailed Outline",
      key_takeaways: "Key Takeaways",
      action_items: "Action Items",
      meeting_minutes: "Meeting Minutes",
      qa_extraction: "Q&A Extraction",
      scene_analysis: "Scene Analysis",
      visual_insights: "Visual Insights",
      smart_timestamps: "Smart Timestamps",
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
      video_content: "video content",
      educational_video: "an educational video",
      documentary: "a documentary",
      other: "content",
    };

    const selectedSections = outputs
      .map((o) => outputLabels[o] || o)
      .map((label) => `- ${label}`)
      .join("\n");

    const baseGuidelines = `- Be accurate to the ${useVideoAnalysis ? "audio and visual content" : "transcript"} while improving clarity
- Keep factual details, names, dates
- Merge duplicates and remove filler
- Prefer concise language
- For Action Items, include owner (if identifiable) and due dates if present
- For Meeting Minutes, include attendees (if identifiable), agenda, decisions, and next steps
- For Q&A Extraction, list Q paired with A succinctly${useVideoAnalysis ? "\n- For Scene Analysis, break down the content by visual scenes and topics\n- For Visual Insights, highlight important visual elements, diagrams, or on-screen content\n- For Smart Timestamps, provide key moment timestamps with visual and audio descriptions\n- Integrate visual insights with audio content for comprehensive notes" : "\n- For Smart Timestamps, provide key moment timestamps with descriptions"}${timestamps ? "\n- Include relevant timestamps where helpful" : ""}`;

    const notePrompt = `You are an expert note taker. ${useVideoAnalysis ? "Analyze this video content" : "Given a transcript"} from ${typeDescriptorMap[noteType] || "content"} and produce the following sections in Markdown. Use clear headings and bullet points where appropriate.

Sections to include:
${selectedSections}

Guidelines:
${baseGuidelines}

${extraPrompt ? `Additional context: ${extraPrompt}` : ""}`;

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

    const provider = getChatProvider(providerToUse, { env, user });
    const userPrompt = `${extraPrompt ? `${extraPrompt}\n\n` : ""}Transcript:\n\n${transcriptText}`;

    const aiResult = await provider.getResponse(
      {
        model: modelToUse,
        env,
        context,
        messages: [
          { role: "system", content: notePrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      },
      user.id,
    );

    const content =
      aiResult?.response ||
      (Array.isArray(aiResult.choices) && aiResult.choices[0]?.message?.content) ||
      (typeof aiResult === "string" ? aiResult : JSON.stringify(aiResult));

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

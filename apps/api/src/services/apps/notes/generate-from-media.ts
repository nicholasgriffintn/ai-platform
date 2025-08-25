import {
  handleTranscribe,
  TranscriptionProvider,
} from "~/services/audio/transcribe";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getAuxiliaryModel, getModelConfig } from "~/lib/models";
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
  useVideoAnalysis = false,
  enableVideoSearch = false,
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
    | "scene_analysis"
    | "visual_insights"
    | "smart_timestamps"
  )[];
  noteType: string;
  extraPrompt?: string;
  timestamps?: boolean;
  useVideoAnalysis?: boolean;
  enableVideoSearch?: boolean;
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

    if (contentLengthBytes === 0) {
      throw new AssistantError("Empty file", ErrorType.PARAMS_ERROR);
    }

    const TWENTY_MB = 20 * 1024 * 1024;

    let transcriptionProviderToUse: TranscriptionProvider;
    let transcriptText = "";

    if (contentLengthBytes <= TWENTY_MB) {
      transcriptionProviderToUse = "mistral";
    } else {
      transcriptionProviderToUse = "replicate";
    }

    if (!transcriptionProviderToUse) {
      throw new AssistantError(
        "No transcription provider was determined",
        ErrorType.PARAMS_ERROR,
      );
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

    let videoAnalysisContent = "";

    if (useVideoAnalysis) {
      const videoPrompt = `Analyze this video and provide detailed insights about the visual content, scenes, and any visual elements that complement the audio. Focus on:
      - Visual scenes and their context
      - On-screen text, graphics, or diagrams
      - Speaker gestures and expressions
      - Environmental details
      - Visual transitions and key moments
      
      ${extraPrompt ? `Additional context: ${extraPrompt}` : ""}`;

      try {
        const pegasusModelName = "pegasus-video";
        const pegasusModelConfig = await getModelConfig(pegasusModelName);
        const pegasusProvider = AIProviderFactory.getProvider(
          pegasusModelConfig.provider,
        );

        const videoResult = await pegasusProvider.getResponse(
          {
            model: pegasusModelConfig.matchingModel,
            env,
            user,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: videoPrompt },
                  { type: "video_url", video_url: { url } },
                ],
              },
            ],
            temperature: 0.3,
            max_tokens: 2000,
          },
          user.id,
        );

        videoAnalysisContent =
          (videoResult as any)?.response ||
          (Array.isArray((videoResult as any).choices) &&
            (videoResult as any).choices[0]?.message?.content) ||
          (typeof videoResult === "string" ? videoResult : "");
      } catch (error) {
        console.warn(
          "Video analysis failed, falling back to audio-only:",
          error,
        );
      }
    }

    if (enableVideoSearch) {
      try {
        const marengoModelName = "marengo-embed-2-7";
        const marengoModelConfig = await getModelConfig(marengoModelName);
        const marengoProvider = AIProviderFactory.getProvider(
          marengoModelConfig.provider,
        );

        await marengoProvider.getResponse(
          {
            model: marengoModelConfig.matchingModel,
            env,
            user,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Generate embeddings for video search",
                  },
                  { type: "video_url", video_url: { url } },
                ],
              },
            ],
          },
          user.id,
        );
      } catch (error) {
        console.warn("Video embedding generation failed:", error);
      }
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

    const hasVideoAnalysis =
      videoAnalysisContent &&
      outputs.some((o) =>
        ["scene_analysis", "visual_insights", "smart_timestamps"].includes(o),
      );

    const systemPrompt = `You are an expert note taker. Given ${hasVideoAnalysis ? "a transcript and video analysis" : "a transcript"} from ${
      typeDescriptorMap[noteType] || "content"
    }, produce the following sections in Markdown. Use clear headings and bullet points where appropriate. Sections to include:\n${selectedSections}\n\nGuidelines:\n- Be accurate to the ${hasVideoAnalysis ? "transcript and visual content" : "transcript"} while improving clarity\n- Keep factual details, names, dates\n- Merge duplicates and remove filler\n- Prefer concise language\n- For Action Items, include owner (if identifiable) and due dates if present\n- For Meeting Minutes, include attendees (if identifiable), agenda, decisions, and next steps\n- For Q&A Extraction, list Q paired with A succinctly\n- For Scene Analysis, break down the content by visual scenes and topics\n- For Visual Insights, highlight important visual elements, diagrams, or on-screen content\n- For Smart Timestamps, provide key moment timestamps with descriptions\n${hasVideoAnalysis ? "- Integrate visual insights with audio content for comprehensive notes" : ""}\n`;

    const userPrompt = `${extraPrompt ? `${extraPrompt}\n\n` : ""}${hasVideoAnalysis ? `Video Analysis:\n${videoAnalysisContent}\n\n` : ""}Transcript:\n\n${transcriptText}`;

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

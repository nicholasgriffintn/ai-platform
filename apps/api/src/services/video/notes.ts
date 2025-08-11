import { getAuxiliaryModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import { RepositoryManager } from "~/repositories";
import type { ChatRole, IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { handleTranscribe } from "../audio/transcribe";
import { VideoAudioExtractorFactory, type VideoMetadata } from "./extractAudio";

const logger = getLogger({ prefix: "SERVICES:VIDEO:NOTES" });

export interface HandleVideoToNotesRequest {
  env: IEnv;
  user: IUser;
  url: string;
  timestamps?: boolean;
  provider?: "workers" | "mistral";
  generateSummary?: boolean;
}

export interface VideoNoteData {
  id: string;
  title: string;
  content: string;
  transcript: string;
  metadata: Record<string, any> & VideoMetadata;
  status: "pending" | "processing" | "complete" | "error";
  createdAt: string;
}

async function generateNotesFromTranscript(
  env: IEnv,
  user: IUser,
  transcript: string,
  videoMeta: VideoMetadata,
): Promise<{ title: string; content: string }> {
  try {
    const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(env, user);
    const provider = AIProviderFactory.getProvider(providerToUse);

    const prompt = `You are an expert note-taker. Create clear, structured notes from the provided transcript.
Include:
- A concise title
- A 3-5 sentence executive summary at the top
- Key takeaways as bullet points
- Any action items

Include the source platform and any relevant context if present.

Transcript:
${transcript}`;

    const aiResult = await provider.getResponse(
      {
        model: modelToUse,
        env,
        user,
        messages: [{ role: "user" as ChatRole, content: prompt }],
        temperature: 0.5,
        max_tokens: 2048,
      },
      user.id,
    );

    const content =
      (aiResult as any)?.response ||
      (Array.isArray((aiResult as any).choices) && (aiResult as any).choices[0]?.message?.content) ||
      (typeof aiResult === "string" ? aiResult : JSON.stringify(aiResult));

    const title = videoMeta.videoTitle || "Video Notes";

    return { title, content };
  } catch (error) {
    logger.error("Failed to generate notes from transcript", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    // Fallback: return raw transcript as content
    return { title: videoMeta.videoTitle || "Video Notes", content: transcript };
  }
}

export async function handleVideoToNotes(
  req: HandleVideoToNotesRequest,
): Promise<IFunctionResponse> {
  const { env, user, url, timestamps = false, provider = "workers", generateSummary = true } = req;

  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }
  if (!url) {
    throw new AssistantError("Missing video URL", ErrorType.PARAMS_ERROR);
  }

  try {
    const extractor = VideoAudioExtractorFactory.getDefault();
    const { audio, metadata } = await extractor.extractAudio(env, url);

    const transcribeResponse = await handleTranscribe({
      env,
      audio,
      user,
      provider,
      timestamps,
    });

    const transcript = Array.isArray(transcribeResponse)
      ? transcribeResponse.map((r) => r.content).join("\n")
      : (transcribeResponse.content as string);

    const noteId = generateId();
    const repositories = RepositoryManager.getInstance(env);

    const createdAt = new Date().toISOString();

    let finalTitle = metadata.videoTitle || "Video Notes";
    let finalContent = transcript;

    if (generateSummary) {
      const generated = await generateNotesFromTranscript(env, user, transcript, metadata);
      finalTitle = generated.title || finalTitle;
      finalContent = generated.content || finalContent;
    }

    const appData = {
      title: finalTitle,
      content: finalContent,
      transcript,
      metadata: {
        ...metadata,
        provider,
        timestamps,
        processingStatus: "complete",
      },
      status: "complete",
      createdAt,
    } satisfies Omit<VideoNoteData, "id">;

    const created = await repositories.appData.createAppDataWithItem(
      user.id,
      "video-notes",
      noteId,
      "note",
      appData,
    );

    return {
      status: "success",
      content: "Video note created successfully",
      data: {
        noteId,
        processingStatus: "complete",
        transcript,
        metadata,
        createdId: created.id,
      },
    };
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }
    logger.error("Failed to create video notes", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new AssistantError("Failed to generate notes from video", ErrorType.UNKNOWN_ERROR);
  }
}
import {
	handleTranscribe,
	TranscriptionProvider,
} from "~/services/audio/transcribe";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getAuxiliaryModel, getModelConfig } from "~/lib/models";
import { Database } from "~/lib/database";
import { Embedding } from "~/lib/embedding";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

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
								{ type: "text", text: notePrompt },
								{ type: "video_url", video_url: { url } },
							],
						},
					],
					temperature: 0.3,
					max_tokens: 3000,
				},
				user.id,
			);

			if (enableVideoSearch) {
				try {
					const database = Database.getInstance(env);
					const userSettings = await database.getUserSettings(user.id);
					const embedding = Embedding.getInstance(env, user, userSettings);

					const videoId = `video-${Date.now()}-${generateId()}`;
					const metadata = {
						url,
						type: "video",
						timestamp: new Date().toISOString(),
						userId: user.id.toString(),
					};

					const embeddings = await embedding.generate(
						"video",
						`Video content from ${url}`,
						videoId,
						metadata,
					);

					await embedding.insert(embeddings, {
						namespace: `user_kb_${user.id}`,
						type: "video",
					});

					await database.insertEmbedding(
						videoId,
						metadata,
						`Video: ${url}`,
						`Video content from ${url}`,
						"video",
					);
				} catch (error) {
					console.warn("Video embedding generation failed:", error);
				}
			}

			return { content: videoResult.response };
		}

		const isS3Url = url.startsWith("s3://");
		let transcriptText = "";

		if (isS3Url) {
			throw new AssistantError(
				"S3 URLs are not supported for transcription",
				ErrorType.PARAMS_ERROR,
			);
		}

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

		const { model: modelToUse, provider: providerToUse } =
			await getAuxiliaryModel(env, user);

		const provider = AIProviderFactory.getProvider(providerToUse);

		const userPrompt = `${extraPrompt ? `${extraPrompt}\n\n` : ""}Transcript:\n\n${transcriptText}`;

		const aiResult = await provider.getResponse(
			{
				model: modelToUse,
				env,
				user,
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

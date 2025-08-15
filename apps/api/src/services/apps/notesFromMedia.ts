import { handleTranscribe } from "~/services/audio/transcribe";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getAuxiliaryModel, getModelConfigByMatchingModel } from "~/lib/models";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const REPLICATE_TRANSCRIBE_VERSION =
	"cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f"; // same as podcasts

async function transcribeWithReplicate(env: IEnv, user: IUser, url: string) {
	const modelConfig = await getModelConfigByMatchingModel(
		REPLICATE_TRANSCRIBE_VERSION,
	);
	const provider = AIProviderFactory.getProvider(
		modelConfig?.provider || "replicate",
	);

	const transcriptionData = await provider.getResponse({
		version: REPLICATE_TRANSCRIBE_VERSION,
		messages: [
			{
				role: "user",
				// @ts-ignore replicate format
				content: {
					file: url,
					language: "en",
					transcript_output_format: "segments_only",
					group_segments: true,
					translate: false,
					offset_seconds: 0,
				},
			},
		],
		env,
		user,
		should_poll: true,
	});

	let text = "";
	try {
		const out: any = transcriptionData?.output ?? transcriptionData;
		if (Array.isArray(out?.segments)) {
			text = out.segments.map((s: any) => s.text).join(" ").trim();
		} else if (typeof out?.text === "string") {
			text = out.text;
		} else if (typeof transcriptionData?.text === "string") {
			text = transcriptionData.text;
		}
	} catch {}

	if (!text) {
		throw new AssistantError(
			"Failed to parse transcription output from Replicate",
			ErrorType.EXTERNAL_API_ERROR,
		);
	}

	return text;
}

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
		// Try to determine size (for Mistral 20MB limit)
		let contentLengthBytes = 0;
		try {
			const head = await fetch(url, { method: "HEAD" });
			const len = head.headers.get("content-length");
			contentLengthBytes = len ? Number(len) : 0;
		} catch {
			// ignore if HEAD fails
		}

		const TWENTY_MB = 20 * 1024 * 1024;
		const canUseMistral = Boolean((env as any).MISTRAL_API_KEY) &&
			Boolean((env as any).AI_GATEWAY_TOKEN) &&
			Boolean((env as any).ACCOUNT_ID);

		let transcriptText = "";

		if (canUseMistral && contentLengthBytes > 0 && contentLengthBytes <= TWENTY_MB) {
			// Prefer Mistral when within size limits
			const transcription = await handleTranscribe({
				env,
				user,
				audio: url,
				provider: "mistral",
				timestamps: !!timestamps,
			});
			transcriptText = typeof transcription.content === "string" ? transcription.content : "";
		} else if (contentLengthBytes > TWENTY_MB) {
			// Large file: use Replicate async polling
			transcriptText = await transcribeWithReplicate(env, user, url);
		} else {
			// Fallback: Workers (will fetch and transcribe)
			const transcription = await handleTranscribe({
				env,
				user,
				audio: url,
				provider: "workers",
				timestamps: !!timestamps,
			});
			transcriptText = typeof transcription.content === "string" ? transcription.content : "";
		}

		if (!transcriptText) {
			throw new AssistantError("Empty transcript returned", ErrorType.EXTERNAL_API_ERROR);
		}

		const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(env, user);
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
			(typeof aiResult === "string" ? (aiResult as string) : JSON.stringify(aiResult));

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
import type {
	Note,
	NoteCreateRequest,
	NoteFormatResponse,
	NoteUpdateRequest,
} from "@assistant/schemas";

import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliaryModel } from "~/lib/providers/models";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { requireOutputRecordAccess } from "~/services/outputs/access";
import type { ChatRole, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";
import { safeParseJson } from "../../../utils/json";

const logger = getLogger();

function mapOutputToNote(entry: OutputRecord): Note {
	const data = safeParseJson<Record<string, unknown>>(entry.content) ?? {};
	return {
		id: entry.id,
		title: typeof data.title === "string" ? data.title : "",
		content: typeof data.content === "string" ? data.content : "",
		createdAt: entry.created_at,
		updatedAt: entry.updated_at ?? entry.created_at,
		metadata: isRecord(data.metadata) ? data.metadata : undefined,
	};
}

export async function listNotes({
	context,
	env,
	userId,
	projectId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
	projectId?: string;
}): Promise<Note[]> {
	if (!userId) {
		throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.outputs;
	const list = projectId
		? await repo.listProjectOutputs(projectId, "notes")
		: await repo.listPersonalOutputs(userId, "notes");

	return list.map(mapOutputToNote);
}

export async function getNote({
	context,
	env,
	userId,
	noteId,
	projectId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
	noteId: string;
	projectId?: string;
}): Promise<Note> {
	if (!userId || !noteId) {
		throw new AssistantError("Note ID and user ID are required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.outputs;
	const entry = projectId
		? await repo.getProjectOutput(projectId, noteId)
		: await repo.getPersonalOutput(userId, noteId);

	if (!entry || entry.capability_id !== "notes" || entry.kind !== "note") {
		throw new AssistantError("Note not found", ErrorType.NOT_FOUND, 404);
	}

	return mapOutputToNote(entry);
}

export async function createNote({
	context,
	env,
	user,
	data,
	projectId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	data: NoteCreateRequest;
	projectId?: string;
}): Promise<Note> {
	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.outputs;
	const noteId = generateId();

	const sanitisedTitle = sanitiseInput(data.title);
	const sanitisedContent = sanitiseInput(data.content);

	const generatedMetadata = await generateNoteMetadata(
		serviceContext,
		user,
		sanitisedTitle,
		sanitisedContent,
		data.metadata,
	);

	const appData = {
		title: sanitisedTitle,
		content: sanitisedContent,
		metadata: { ...generatedMetadata, ...data.metadata },
	};

	const entry = await repo.createOutput({
		id: noteId,
		createdByUserId: user.id,
		projectId,
		capabilityId: "notes",
		groupId: noteId,
		kind: "note",
		title: sanitisedTitle,
		content: appData,
	});

	return mapOutputToNote(entry);
}

export async function updateNote({
	context,
	env,
	user,
	noteId,
	data,
	projectId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	noteId: string;
	data: NoteUpdateRequest;
	projectId?: string;
}): Promise<Note> {
	if (!user?.id || !noteId) {
		throw new AssistantError("Note ID and user ID are required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.outputs;
	const existing = projectId
		? await repo.getProjectOutput(projectId, noteId)
		: await repo.getPersonalOutput(user.id, noteId);

	if (!existing || existing.capability_id !== "notes" || existing.kind !== "note") {
		throw new AssistantError("Note not found", ErrorType.NOT_FOUND, 404);
	}
	await requireOutputRecordAccess(serviceContext, user.id, existing, true);

	const parsedExistingData = safeParseJson<Record<string, unknown>>(existing.content) ?? {};
	const existingMetadata = isRecord(parsedExistingData.metadata) ? parsedExistingData.metadata : {};

	const sanitisedTitle = sanitiseInput(data.title);
	const sanitisedContent = sanitiseInput(data.content);

	const incomingMetadata = isRecord(data.metadata) ? data.metadata : {};
	const hasExistingMetadata = existingMetadata && Object.keys(existingMetadata).length > 0;
	const shouldRegenerateMetadata = Boolean(data.options?.refreshMetadata) || !hasExistingMetadata;

	const wordCount = sanitisedContent.split(/\s+/).length;
	const existingReadingTime =
		typeof existingMetadata.readingTime === "number" ? existingMetadata.readingTime : 1;
	const readingTime = wordCount ? Math.max(1, Math.ceil(wordCount / 200)) : existingReadingTime;

	let mergedMetadata = {
		...existingMetadata,
		...incomingMetadata,
	};

	if (shouldRegenerateMetadata) {
		const generatedMetadata = await generateNoteMetadata(
			serviceContext,
			user,
			sanitisedTitle,
			sanitisedContent,
			mergedMetadata,
		);
		mergedMetadata = {
			...mergedMetadata,
			wordCount,
			tags: mergedMetadata.tags || [],
			summary: mergedMetadata.summary || "",
			keyTopics: mergedMetadata.keyTopics || [],
			readingTime: readingTime,
			contentType: mergedMetadata.contentType || "text",
			...generatedMetadata,
		};
	}

	mergedMetadata = {
		...mergedMetadata,
		wordCount,
		tags: mergedMetadata.tags || [],
		summary: mergedMetadata.summary || "",
		keyTopics: mergedMetadata.keyTopics || [],
		readingTime: readingTime,
		contentType: mergedMetadata.contentType || "text",
	};

	const finalData = {
		title: sanitisedTitle,
		content: sanitisedContent,
		metadata: mergedMetadata,
	};

	const updated = await repo.updateOutput(noteId, {
		title: sanitisedTitle,
		content: finalData,
		expectedRevision: existing.revision,
		updatedByUserId: user.id,
	});

	return mapOutputToNote(updated);
}

export async function deleteNote({
	context,
	env,
	user,
	noteId,
	projectId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	noteId: string;
	projectId?: string;
}): Promise<void> {
	if (!user?.id || !noteId) {
		throw new AssistantError("Note ID and user ID are required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.outputs;
	const existing = projectId
		? await repo.getProjectOutput(projectId, noteId)
		: await repo.getPersonalOutput(user.id, noteId);

	if (!existing || existing.capability_id !== "notes" || existing.kind !== "note") {
		throw new AssistantError("Note not found", ErrorType.NOT_FOUND, 404);
	}
	await requireOutputRecordAccess(serviceContext, user.id, existing, true);

	await repo.deleteOutput(noteId);
}

export async function formatNote({
	context,
	env,
	user,
	noteId,
	prompt,
	projectId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	noteId: string;
	prompt?: string;
	projectId?: string;
}): Promise<NoteFormatResponse> {
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const runtimeEnv = serviceContext.env as IEnv;

	const note = await getNote({
		context: serviceContext,
		userId: user.id,
		noteId,
		projectId,
	});

	const promptText = `Transform and enhance my notes using these guidelines:

1. ORGANIZATION:
   - Identify the main topic and create a concise title if none exists
   - Organize related bullet points under appropriate headings
   - Create a logical flow between sections with smooth transitions
   - Format lists, tables, and other structured elements consistently

2. CONTENT ENHANCEMENT:
   - Expand abbreviated points into complete sentences where appropriate
   - Maintain key information while eliminating redundancies
   - Add brief introductory and concluding paragraphs if appropriate
   - Preserve my original voice and terminology

3. INSIGHT EXTRACTION:
   - Highlight key points, conclusions, and important information
   - Identify and separate action items or tasks into a dedicated "To-Do" section
   - Extract dates and deadlines into a "Timeline" section if applicable
   - Flag areas that need further development or clarification

4. SUMMARIZATION:
   - Generate a concise summary (3-5 sentences) at the beginning
   - For longer notes, add section summaries where appropriate

5. CONNECTIONS:
   - Suggest related topics or concepts based on the content
   - Identify potential knowledge gaps that could be explored further
   - Propose questions that would help expand the topic

6. FORMATTING:
   - Apply consistent styling to headings, lists, and emphasis
   - Preserve any specialized terminology or jargon
   - Adjust tone if specified (professional, academic, casual)

Maintain the original meaning and intent of my notes while improving structure, clarity, and completeness. Focus on making the content more useful and actionable.

Here is the note to format:

${note.content}`;

	try {
		const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(
			runtimeEnv,
			user,
		);
		const provider = getChatProvider(providerToUse, { env: runtimeEnv, user });

		const messages = [
			{
				role: "system" as ChatRole,
				content: promptText,
			},
		];

		if (prompt) {
			const sanitisedPrompt = sanitiseInput(prompt);
			messages.push({
				role: "user" as ChatRole,
				content: sanitisedPrompt,
			});
		}

		const aiResult = await provider.getResponse(
			{
				model: modelToUse,
				env: runtimeEnv,
				context: serviceContext,
				messages,
				temperature: 0.7,
				max_tokens: 2048,
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
		throw new AssistantError("Error formatting note with AI", ErrorType.EXTERNAL_API_ERROR);
	}
}

async function generateNoteMetadata(
	context: ServiceContext,
	user: IUser,
	title: string,
	content: string,
	existingMetadata?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const env = context.env as IEnv;
	const tabSource = isRecord(existingMetadata?.tabSource) ? existingMetadata.tabSource : undefined;
	const tabSourceText = tabSource
		? `\n\nNote: This content was captured from tab audio recording:
- URL: ${typeof tabSource.url === "string" ? tabSource.url : "Unknown"}  
- Page Title: ${typeof tabSource.title === "string" ? tabSource.title : "Unknown"}
- Captured: ${typeof tabSource.timestamp === "string" ? tabSource.timestamp : "Unknown"}`
		: "";

	const prompt = `Analyze this note and generate metadata in JSON format. Include:
- tags: array of relevant tags (max 8)  
- summary: brief 1-2 sentence summary
- keyTopics: array of main topics/keywords (max 5)
- wordCount: number of words
- readingTime: estimated reading time in minutes
- contentType: "text", "list", "outline", or "mixed"
- sentiment: "positive", "neutral", or "negative" based on the tone
${tabSource ? '- sourceType: "tab_recording" since this was captured from a tab' : '- sourceType: "manual" since this was manually written'}

Title: ${title}
Content: ${content}${tabSourceText}

Return only valid JSON without any markdown formatting.`;

	try {
		const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(env, user);
		const provider = getChatProvider(providerToUse, { env, user });

		const aiResult = await provider.getResponse(
			{
				model: modelToUse,
				env,
				context,
				messages: [{ role: "user" as ChatRole, content: prompt }],
				temperature: 0.3,
				max_tokens: 500,
			},
			user.id,
		);

		const response =
			aiResult?.response ||
			(Array.isArray(aiResult.choices) && aiResult.choices[0]?.message?.content) ||
			(typeof aiResult === "string" ? aiResult : "{}");

		return safeParseJson<Record<string, unknown>>(response) ?? {};
	} catch (error) {
		logger.error("Error generating note metadata", { error });
	}

	return {};
}

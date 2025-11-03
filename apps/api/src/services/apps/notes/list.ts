import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliaryModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { ChatRole, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger();

export interface Note {
	id: string;
	title: string;
	content: string;
	createdAt: string;
	updatedAt: string;
	metadata?: Record<string, any>;
}

export async function listNotes({
	context,
	env,
	userId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
}): Promise<Note[]> {
	if (!userId) {
		throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.appData;
	const list = await repo.getAppDataByUserAndApp(userId, "notes");

	return list.map((entry) => {
		let data;
		try {
			data = JSON.parse(entry.data);
		} catch (e) {
			logger.error("Failed to parse note data", { error: e });
			data = {};
		}
		return {
			id: entry.id,
			title: data.title,
			content: data.content,
			createdAt: entry.created_at,
			updatedAt: entry.updated_at,
			metadata: data.metadata,
		};
	});
}

export async function getNote({
	context,
	env,
	userId,
	noteId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
	noteId: string;
}): Promise<Note> {
	if (!userId || !noteId) {
		throw new AssistantError(
			"Note ID and user ID are required",
			ErrorType.PARAMS_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.appData;
	const entry = await repo.getAppDataById(noteId);

	if (!entry || entry.user_id !== userId || entry.app_id !== "notes") {
		throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
	}

	let data;
	try {
		data = JSON.parse(entry.data);
	} catch (e) {
		logger.error("Failed to parse note data", { error: e });
		data = {};
	}

	return {
		id: entry.id,
		title: data.title,
		content: data.content,
		createdAt: entry.created_at,
		updatedAt: entry.updated_at,
		metadata: data.metadata,
	};
}

export async function createNote({
	context,
	env,
	user,
	data,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	data: { title: string; content: string; metadata?: Record<string, any> };
}): Promise<Note> {
	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const runtimeEnv = serviceContext.env as IEnv;
	const repo = serviceContext.repositories.appData;
	const noteId = generateId();

	const sanitisedTitle = sanitiseInput(data.title);
	const sanitisedContent = sanitiseInput(data.content);

	const generatedMetadata = await generateNoteMetadata(
		runtimeEnv,
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

	const entry = await repo.createAppDataWithItem(
		user.id,
		"notes",
		noteId,
		"note",
		appData,
	);

	const full = await repo.getAppDataById(entry.id);
	let parsed;
	try {
		parsed = JSON.parse(full!.data);
	} catch (e) {
		logger.error("Failed to parse note data", { error: e });
		parsed = {};
	}

	return {
		id: full!.id,
		title: parsed.title,
		content: parsed.content,
		createdAt: full!.created_at,
		updatedAt: full!.updated_at,
		metadata: parsed.metadata,
	};
}

export async function updateNote({
	context,
	env,
	user,
	noteId,
	data,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	noteId: string;
	data: { title: string; content: string; metadata?: Record<string, any> };
}): Promise<Note> {
	if (!user?.id || !noteId) {
		throw new AssistantError(
			"Note ID and user ID are required",
			ErrorType.PARAMS_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const runtimeEnv = serviceContext.env as IEnv;
	const repo = serviceContext.repositories.appData;
	const existing = await repo.getAppDataById(noteId);

	if (
		!existing ||
		existing.user_id !== user.id ||
		existing.app_id !== "notes"
	) {
		throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
	}

	const generatedMetadata = await generateNoteMetadata(
		runtimeEnv,
		user,
		data.title,
		data.content,
		data.metadata,
	);
	const finalData = {
		...data,
		metadata: { ...generatedMetadata, ...data.metadata },
	};

	await repo.updateAppData(noteId, finalData);
	const updated = await repo.getAppDataById(noteId);
	let parsedData;
	try {
		parsedData = JSON.parse(updated!.data);
	} catch (e) {
		logger.error("Failed to parse note data", { error: e });
		parsedData = {};
	}

	return {
		id: updated!.id,
		title: parsedData.title,
		content: parsedData.content,
		createdAt: updated!.created_at,
		updatedAt: updated!.updated_at,
		metadata: parsedData.metadata,
	};
}

export async function deleteNote({
	context,
	env,
	user,
	noteId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	noteId: string;
}): Promise<void> {
	if (!user?.id || !noteId) {
		throw new AssistantError(
			"Note ID and user ID are required",
			ErrorType.PARAMS_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.appData;
	const existing = await repo.getAppDataById(noteId);

	if (
		!existing ||
		existing.user_id !== user.id ||
		existing.app_id !== "notes"
	) {
		throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
	}

	await repo.deleteAppData(noteId);
}

export async function formatNote({
	context,
	env,
	user,
	noteId,
	prompt,
}: {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	noteId: string;
	prompt?: string;
}): Promise<{ content: string }> {
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const runtimeEnv = serviceContext.env as IEnv;

	const note = await getNote({
		context: serviceContext,
		userId: user.id,
		noteId,
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
		const { model: modelToUse, provider: providerToUse } =
			await getAuxiliaryModel(runtimeEnv, user);
		const provider = AIProviderFactory.getProvider(providerToUse);

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
				user,
				messages,
				temperature: 0.7,
				max_tokens: 2048,
			},
			user.id,
		);

		const content =
			aiResult?.response ||
			(Array.isArray(aiResult.choices) &&
				aiResult.choices[0]?.message?.content) ||
			(typeof aiResult === "string" ? aiResult : JSON.stringify(aiResult));

		return { content };
	} catch (error) {
		if (error instanceof AssistantError) {
			throw error;
		}
		throw new AssistantError(
			"Error formatting note with AI",
			ErrorType.EXTERNAL_API_ERROR,
		);
	}
}

async function generateNoteMetadata(
	env: IEnv,
	user: IUser,
	title: string,
	content: string,
	existingMetadata?: Record<string, any>,
): Promise<Record<string, any>> {
	const tabSource = existingMetadata?.tabSource;
	const tabSourceText = tabSource
		? `\n\nNote: This content was captured from tab audio recording:
- URL: ${tabSource.url || "Unknown"}  
- Page Title: ${tabSource.title || "Unknown"}
- Captured: ${tabSource.timestamp}`
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
		const { model: modelToUse, provider: providerToUse } =
			await getAuxiliaryModel(env, user);
		const provider = AIProviderFactory.getProvider(providerToUse);

		const aiResult = await provider.getResponse(
			{
				model: modelToUse,
				env,
				user,
				messages: [{ role: "user" as ChatRole, content: prompt }],
				temperature: 0.3,
				max_tokens: 500,
			},
			user.id,
		);

		const response =
			aiResult?.response ||
			(Array.isArray(aiResult.choices) &&
				aiResult.choices[0]?.message?.content) ||
			(typeof aiResult === "string" ? aiResult : "{}");

		return JSON.parse(response);
	} catch (error) {
		logger.error("Error generating note metadata", { error });
		const wordCount = content.split(/\s+/).length;
		return {
			tags: [],
			summary: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
			keyTopics: [],
			wordCount,
			readingTime: Math.max(1, Math.ceil(wordCount / 200)),
			contentType: "text",
		};
	}
}

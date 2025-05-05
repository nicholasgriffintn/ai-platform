import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliaryModel } from "~/lib/models";
import { AIProviderFactory } from "~/providers/factory";
import { RepositoryManager } from "~/repositories";
import type { ChatRole, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export async function listNotes({
  env,
  userId,
}: { env: IEnv; userId: number }): Promise<Note[]> {
  if (!userId) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const list = await repo.getAppDataByUserAndApp(userId, "notes");

  return list.map((entry) => {
    const data = JSON.parse(entry.data);
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
  env,
  userId,
  noteId,
}: { env: IEnv; userId: number; noteId: string }): Promise<Note> {
  if (!userId || !noteId) {
    throw new AssistantError(
      "Note ID and user ID are required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const entry = await repo.getAppDataById(noteId);

  if (!entry || entry.user_id !== userId || entry.app_id !== "notes") {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
  }

  const data = JSON.parse(entry.data);

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
  env,
  user,
  data,
}: {
  env: IEnv;
  user: IUser;
  data: { title: string; content: string; metadata?: Record<string, any> };
}): Promise<Note> {
  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }
  const repo = RepositoryManager.getInstance(env).appData;
  const noteId = generateId();

  const sanitisedTitle = sanitiseInput(data.title);
  const sanitisedContent = sanitiseInput(data.content);

  const appData = {
    title: sanitisedTitle,
    content: sanitisedContent,
    metadata: data.metadata,
  };

  const entry = await repo.createAppDataWithItem(
    user.id,
    "notes",
    noteId,
    "note",
    appData,
  );

  const full = await repo.getAppDataById(entry.id);
  const parsed = JSON.parse(full!.data);

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
  env,
  userId,
  noteId,
  data,
}: {
  env: IEnv;
  userId: number;
  noteId: string;
  data: { title: string; content: string; metadata?: Record<string, any> };
}): Promise<Note> {
  if (!userId || !noteId) {
    throw new AssistantError(
      "Note ID and user ID are required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const existing = await repo.getAppDataById(noteId);

  if (!existing || existing.user_id !== userId || existing.app_id !== "notes") {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
  }

  await repo.updateAppData(noteId, data);
  const updated = await repo.getAppDataById(noteId);
  const parsed = JSON.parse(updated!.data);

  return {
    id: updated!.id,
    title: parsed.title,
    content: parsed.content,
    createdAt: updated!.created_at,
    updatedAt: updated!.updated_at,
    metadata: parsed.metadata,
  };
}

export async function deleteNote({
  env,
  userId,
  noteId,
}: { env: IEnv; userId: number; noteId: string }): Promise<void> {
  if (!userId || !noteId) {
    throw new AssistantError(
      "Note ID and user ID are required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const repo = RepositoryManager.getInstance(env).appData;
  const existing = await repo.getAppDataById(noteId);

  if (!existing || existing.user_id !== userId || existing.app_id !== "notes") {
    throw new AssistantError("Note not found", ErrorType.NOT_FOUND);
  }

  await repo.deleteAppData(noteId);
}

export async function formatNote({
  env,
  user,
  noteId,
  prompt,
}: {
  env: IEnv;
  user: IUser;
  noteId: string;
  prompt?: string;
}): Promise<{ content: string }> {
  const note = await getNote({ env, userId: user.id, noteId });

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
      await getAuxiliaryModel(env, user);
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
        env,
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

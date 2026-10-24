import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import type {
  ConversationNotebook,
  NotebookChatStyle,
  NotebookResponseLength,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import {
  readNotebookSettings,
  shouldSearchNotebookSources,
} from "~/modules/notebooks/domain/notebook";
import { formatSourceCitation } from "~/modules/sources/domain/citation";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import type { NotebookRunScope } from "~/types";

import { findNotebookAccess } from "./access";
import { resolveNotebookSources } from "./notebooks";

const SEARCH_TOOL_NAME = "search_documents";
const CONVERSATIONS_TOOL_NAME = "search_conversations";

export const NOTEBOOK_WEB_TOOL_NAMES = ["web_search", "research", "extract_content"] as const;

const STYLE_GUIDANCE: Record<NotebookChatStyle, string> = {
  default: "a knowledgeable research partner: direct, accurate and helpful for brainstorming.",
  learning_guide:
    "a patient tutor: check what the person already knows, explain step by step, and end with a question that tests their understanding rather than handing over every answer.",
  custom: "the role described below.",
};

const LENGTH_GUIDANCE: Record<NotebookResponseLength, string> = {
  default: "as long as the question needs.",
  longer: "thorough, with detail and examples from the sources.",
  shorter: "brief: a few sentences unless the person asks for more.",
};

export interface NotebookProjection {
  section: string | null;
  tools: string[];
  disabledTools: string[];
  scope: NotebookRunScope | null;
}

const EMPTY_PROJECTION: NotebookProjection = {
  section: null,
  tools: [],
  disabledTools: [],
  scope: null,
};

function describeSources(sources: readonly SourceRecord[], searching: boolean): string {
  if (!searching) {
    return [
      "<notebook_sources>",
      ...sources.map((source) =>
        [
          `<source title="${source.title.replaceAll('"', "'")}" cite="${formatSourceCitation(source)}">`,
          source.content?.trim() || "This source has no text.",
          "</source>",
        ].join("\n"),
      ),
      "</notebook_sources>",
    ].join("\n");
  }

  return [
    "<notebook_sources>",
    `There are ${sources.length} sources, too many to include here. Call ${SEARCH_TOOL_NAME} to find the passages you need before answering; it only searches these sources.`,
    ...sources.map(
      (source) => `- ${source.title} (id ${source.id}), cite as ${formatSourceCitation(source)}`,
    ),
    "</notebook_sources>",
  ].join("\n");
}

export async function resolveNotebookProjection({
  context,
  conversationId,
  requested,
  requestedProjectId,
  contextWindow,
}: {
  context: ServiceContext | undefined;
  conversationId: string | undefined;
  requested: ConversationNotebook | null;
  requestedProjectId: string | null;
  contextWindow: number | undefined;
}): Promise<NotebookProjection> {
  if (!context?.user) {
    return EMPTY_PROJECTION;
  }

  const conversation = conversationId
    ? await context.repositories.get(ConversationRepository).getConversation(conversationId)
    : null;
  const storedNotebookId =
    typeof conversation?.group_id === "string" ? conversation.group_id : null;
  const notebookId = conversation ? storedNotebookId : (requested?.id ?? null);

  if (!notebookId) {
    return EMPTY_PROJECTION;
  }

  const access = await findNotebookAccess(context, notebookId);
  const projectId = conversation
    ? typeof conversation.project_id === "string"
      ? conversation.project_id
      : null
    : requestedProjectId;

  if (!access || access.notebook.project_id !== projectId) {
    if (!conversation) {
      throw new AssistantError("Notebook not found", ErrorType.NOT_FOUND, 404);
    }

    return EMPTY_PROJECTION;
  }

  const sources = await resolveNotebookSources(
    context,
    access,
    requested?.id === notebookId ? requested.source_ids : undefined,
  );
  const settings = readNotebookSettings(access.notebook.settings);
  const searching = shouldSearchNotebookSources(sources, contextWindow);

  return {
    section: [
      renderPrompt("notebooks/chat", {
        notebookName: access.notebook.title,
        style: STYLE_GUIDANCE[settings.style],
        length: LENGTH_GUIDANCE[settings.responseLength],
        persona: settings.style === "custom" ? settings.persona : undefined,
        instructions: access.notebook.instructions ?? undefined,
        sourcesOnly: settings.sourcesOnly,
      }),
      sources.length > 0
        ? describeSources(sources, searching)
        : "<notebook_sources>No sources are selected. Ask the person to tick or add some.</notebook_sources>",
    ].join("\n\n"),
    tools: searching ? [SEARCH_TOOL_NAME, CONVERSATIONS_TOOL_NAME] : [CONVERSATIONS_TOOL_NAME],
    disabledTools: settings.sourcesOnly ? [...NOTEBOOK_WEB_TOOL_NAMES] : [],
    scope: {
      notebookId,
      projectId: access.notebook.project_id,
      sourceIds: sources.map((source) => source.id),
    },
  };
}

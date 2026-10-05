import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import { readMemoryDocumentSchema } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  toolErrorResponse,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import {
  MEMORY_READ_TOOL_NAME,
  MEMORY_SEARCH_TOOL_NAME,
  MEMORY_STORE_TOOL_NAME,
  resolveMemoryPolicy,
} from "~/modules/chat/domain/memory";
import { readRunMemoryDocument } from "~/modules/memory-documents/application/pages";
import { queueTeammateMemoryCorrection } from "~/modules/memory-documents/application/reflection";
import { MemoryManager } from "~/modules/memory/application/manager";
import type { IUserSettings } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  read_memory_document as read_memory_documentDescriptor,
  search_memories as search_memoriesDescriptor,
  store_memory as store_memoryDescriptor,
} from "./definitions/memory";

async function getMemoryToolSettings(
  context: Parameters<ApiToolDefinition["execute"]>[1],
  toolName: string,
): Promise<{ userSettings?: IUserSettings | null; error?: string }> {
  if (!context.user?.id || !hasProEntitlement(context.user)) {
    return { error: "Memory tools require a signed-in pro user." };
  }

  const userSettings = await context.request.context?.getUserSettings?.();

  if (!userSettings) {
    return { error: "Memory settings are not available for this request." };
  }

  const memoryPolicy = resolveMemoryPolicy({
    user: context.user,
    userSettings,
    store: context.request.request?.store === true,
  });

  if (!memoryPolicy.toolNames.includes(toolName)) {
    return { userSettings, error: "Memory tool is not enabled for this user." };
  }

  return { userSettings };
}

export const search_memories: ApiToolDefinition = {
  ...search_memoriesDescriptor,
  execute: async (args, context) => {
    const { userSettings, error } = await getMemoryToolSettings(context, MEMORY_SEARCH_TOOL_NAME);

    if (error) {
      return toolErrorResponse(MEMORY_SEARCH_TOOL_NAME, error);
    }

    const query = sanitiseInput(args.query);

    if (!query) {
      return toolErrorResponse(MEMORY_SEARCH_TOOL_NAME, "Missing memory search query.");
    }

    const topK =
      typeof args.top_k === "number" && Number.isFinite(args.top_k)
        ? Math.max(1, Math.min(Math.floor(args.top_k), 10))
        : 5;

    const memoryManager = MemoryManager.getInstance(
      context.env,
      context.user,
      context.request.context,
      context.request.memoryScope,
    );
    const memories = await memoryManager.retrieveMemories(query, {
      topK,
      scoreThreshold: 0.5,
      userSettings,
    });

    return {
      status: "success",
      name: MEMORY_SEARCH_TOOL_NAME,
      content:
        memories.length > 0
          ? memories.map((memory) => `- ${memory.text}`).join("\n")
          : "No relevant memories found.",
      data: { memories },
    };
  },
};

export const store_memory: ApiToolDefinition = {
  ...store_memoryDescriptor,
  execute: async (args, context) => {
    const { userSettings, error } = await getMemoryToolSettings(context, MEMORY_STORE_TOOL_NAME);

    if (error) {
      return toolErrorResponse(MEMORY_STORE_TOOL_NAME, error);
    }

    const text = sanitiseInput(args.text);

    if (!text) {
      return toolErrorResponse(MEMORY_STORE_TOOL_NAME, "Missing memory text.");
    }

    const scope = context.request.memoryScope;
    const completionId =
      context.request.request?.completion_id || context.completionId || undefined;

    if (
      scope?.type === "bound" &&
      scope.teammateContext &&
      (args.document_id === undefined ||
        args.document_id === scope.teammateContext.memoryDocumentId)
    ) {
      const serviceContext = context.request.context;
      const runId = context.request.request?.run_id;

      if (!serviceContext || !completionId || !runId) {
        return toolErrorResponse(MEMORY_STORE_TOOL_NAME, "Memory requires an authorised user run.");
      }

      const taskId = await queueTeammateMemoryCorrection({
        context: serviceContext,
        scope,
        conversationId: completionId,
        runId,
        classify: false,
      });

      return taskId
        ? {
            status: "success",
            name: MEMORY_STORE_TOOL_NAME,
            content:
              "Memory maintenance queued from your message. The correction is not saved yet.",
            data: { taskId },
          }
        : toolErrorResponse(MEMORY_STORE_TOOL_NAME, "No new authorised user evidence to remember.");
    }

    const category =
      typeof args.category === "string" && args.category.trim()
        ? sanitiseInput(args.category).slice(0, 64)
        : "general";
    const memoryManager = MemoryManager.getInstance(
      context.env,
      context.user,
      context.request.context,
      context.request.memoryScope,
    );
    const id = await memoryManager.storeMemory(
      text,
      {
        category,
        conversationId: completionId || "",
        timestamp: Date.now().toString(),
        source: "memory_tool",
      },
      completionId,
      userSettings,
      completionId && context.toolCallId
        ? `memory-tool:${completionId}:${context.toolCallId}`
        : undefined,
      typeof args.document_id === "string" ? args.document_id : undefined,
    );

    if (!id) {
      return toolErrorResponse(MEMORY_STORE_TOOL_NAME, "Memory could not be stored.");
    }

    return {
      status: "success",
      name: MEMORY_STORE_TOOL_NAME,
      content: "Memory stored.",
      data: { id },
    };
  },
};

export const read_memory_document: ApiToolDefinition = {
  ...read_memory_documentDescriptor,
  execute: async (args, { request }) => {
    if (!request.context || !request.memoryScope) {
      throw new AssistantError(
        "Memory document reads require a scoped run",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    if (
      request.memoryScope.type !== "bound" &&
      !resolveMemoryPolicy({
        user: request.context.user,
        userSettings: await request.context.getUserSettings(),
        store: request.request?.store === true,
      }).canRetrieve
    ) {
      throw new AssistantError("Memory retrieval is disabled", ErrorType.FORBIDDEN, 403);
    }

    const page = await readRunMemoryDocument(
      request.context,
      request.memoryScope,
      readMemoryDocumentSchema.parse(args),
    );

    return { status: "success", name: MEMORY_READ_TOOL_NAME, content: page.content, data: page };
  },
};

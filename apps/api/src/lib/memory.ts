import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { getMemoryClassifierPrompt } from "~/lib/prompts/memoryClassifier";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getMemoryProvider } from "~/lib/providers/capabilities/memory";
import type { MemoryProviderId } from "~/lib/providers/capabilities/memory/types";
import { recordProjectAudit } from "~/services/audit";
import type { IEnv, IUser, IUserSettings, MemoryScope, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseAIResponseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import type { ConversationManager } from "./conversationManager";
import { getMemoryNormaliserPrompt } from "./prompts/memoryNormaliser";
import { getMemorySummariserPrompt } from "./prompts/memorySummariser";
import { getAuxiliaryModel } from "./providers/models";

const logger = getLogger({ prefix: "lib/memory" });

export interface MemoryEvent {
  type: "store" | "snapshot";
  text: string;
  category: string;
}

export class MemoryManager {
  private env: IEnv;
  private user?: IUser;
  private serviceContext?: ServiceContext;
  private memoryScope: MemoryScope;

  constructor(
    env: IEnv,
    user?: IUser,
    serviceContext?: ServiceContext,
    memoryScope: MemoryScope = { type: "personal" },
  ) {
    this.env = env;
    this.user = user;
    this.serviceContext = serviceContext;
    this.memoryScope = memoryScope;
  }

  public static getInstance(
    env: IEnv,
    user?: IUser,
    serviceContext?: ServiceContext,
    memoryScope?: MemoryScope,
  ): MemoryManager {
    return new MemoryManager(env, user, serviceContext, memoryScope);
  }

  /**
   * Store a short summary or snippet into the memory vector store under a dedicated namespace
   * @param metadata arbitrary string-based metadata (e.g. conversationId, timestamp, category)
   * @param conversationId optional conversation ID to link this memory to
   */
  public async storeMemory(
    text: string,
    metadata: Record<string, string>,
    conversationId?: string,
    userSettings?: IUserSettings,
  ): Promise<string | null> {
    const provider = getMemoryProvider({
      env: this.env,
      user: this.user,
      userSettings,
      serviceContext: this.serviceContext,
      memoryScope: this.memoryScope,
    });
    const result = await provider.storeMemory({
      text,
      metadata,
      conversationId,
      userSettings,
    });

    if (result.id && this.memoryScope.type === "project" && this.serviceContext && this.user?.id) {
      await recordProjectAudit(this.serviceContext, this.memoryScope.projectId, {
        actorUserId: this.user.id,
        action: "source.created",
        targetType: "source",
        targetId: result.id,
        metadata: { kind: "memory", provider: result.provider },
      });
    }

    return result.id;
  }

  /**
   * Delete a memory from both vector and transactional databases
   * @param memoryId - The memory ID from the transactional database
   */
  public async deleteMemory(memoryId: string, providerId?: MemoryProviderId): Promise<boolean> {
    const userSettings = this.serviceContext
      ? await this.serviceContext.getUserSettings()
      : undefined;

    if (providerId && !userSettings && providerId !== "built-in") {
      throw new AssistantError(
        "User settings are required to delete memory from its recorded provider",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const providerSettings =
      providerId && userSettings ? { ...userSettings, memory_provider: providerId } : userSettings;
    const provider = getMemoryProvider({
      env: this.env,
      user: this.user,
      userSettings: providerSettings,
      serviceContext: this.serviceContext,
      memoryScope: this.memoryScope,
    });

    if (!provider.capabilities.deletion) {
      throw new AssistantError(
        "Selected memory provider does not support deleting individual memories",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    return provider.deleteMemory(memoryId);
  }

  /**
   * Retrieve top‐k memories most relevant to a text query
   * @param query - The text query to retrieve memories for
   * @param opts - Optional parameters for the retrieval
   * @returns An array of memories with their scores
   */
  public async retrieveMemories(
    query: string,
    opts?: { topK?: number; scoreThreshold?: number; userSettings?: IUserSettings | null },
  ): Promise<Array<{ text: string; score: number }>> {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 4) {
      return [];
    }

    const trivialWords = new Set(["hi", "hey", "hello", "sup", "yo"]);
    const words = normalizedQuery.toLowerCase().split(/\s+/);

    if (words.length <= 2 && words.every((w) => trivialWords.has(w))) {
      return [];
    }

    const userSettings =
      opts?.userSettings ??
      (this.serviceContext ? await this.serviceContext.getUserSettings() : undefined);
    const provider = getMemoryProvider({
      env: this.env,
      user: this.user,
      userSettings,
      serviceContext: this.serviceContext,
      memoryScope: this.memoryScope,
    });

    return provider.retrieveMemories(query, {
      topK: opts?.topK,
      scoreThreshold: opts?.scoreThreshold,
      userSettings,
    });
  }

  /**
   * Process a user turn: classify the last user message, store key memories, and take periodic snapshots.
   * @param lastUser - The last user message
   * @param messages - The messages in the conversation
   * @param conversationManager - The conversation manager
   * @param completionId - The ID of the completion
   * @param userSettings - The user settings
   * @returns An array of memory events
   */
  public async handleMemory(
    lastUser: string,
    messages: Message[],
    conversationManager: ConversationManager,
    completionId: string,
    userSettings: IUserSettings,
  ): Promise<MemoryEvent[]> {
    const events: MemoryEvent[] = [];

    if (userSettings?.memories_save_enabled) {
      try {
        if (lastUser.trim()) {
          const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(
            this.env,
            this.user,
          );
          const provider = getChatProvider(providerToUse, {
            env: this.env,
            user: this.user,
          });
          const chatContext =
            this.serviceContext ?? createServiceContext({ env: this.env, user: this.user });
          const classifier = await provider.getResponse(
            {
              model: modelToUse,
              env: this.env,
              context: chatContext,
              messages: [
                {
                  role: "system",
                  content: getMemoryClassifierPrompt(),
                },
                { role: "user", content: lastUser },
              ],
              response_format: { type: "json_object" },
            },
            this.user?.id,
          );

          const parsed = parseAIResponseJson<{
            storeMemory: boolean;
            category: string;
            summary: string;
          }>(classifier.response);

          if (parsed.data?.storeMemory) {
            const summaryText = parsed.data.summary || lastUser;
            const category = parsed.data.category || "general";

            await this.storeMemory(
              summaryText,
              {
                conversationId: completionId,
                timestamp: Date.now().toString(),
                category,
                isNormalized: "false",
              },
              completionId,
              userSettings,
            );

            if (["fact", "schedule", "preference"].includes(category)) {
              try {
                const normalizer = await provider.getResponse(
                  {
                    model: modelToUse,
                    env: this.env,
                    context: chatContext,
                    messages: [
                      {
                        role: "system",
                        content: getMemoryNormaliserPrompt(),
                      },
                      { role: "user", content: summaryText },
                    ],
                    response_format: { type: "json_object" },
                  },
                  this.user?.id,
                );

                try {
                  let normalized: string[] = [];
                  const response = normalizer.response?.trim() || "";

                  const parsedResponse = parseAIResponseJson<string[] | { text: string[] }>(
                    response,
                  );

                  if (parsedResponse) {
                    if (Array.isArray(parsedResponse.data)) {
                      normalized = parsedResponse.data;
                    } else if (
                      parsedResponse.data?.text &&
                      Array.isArray(parsedResponse.data.text)
                    ) {
                      normalized = parsedResponse.data.text;
                    }
                  }

                  normalized = normalized
                    .filter((text) => typeof text === "string" && text.trim().length > 0)
                    .map((text) => text.trim())
                    .filter(
                      (text) => !text.includes("###") && !text.includes("**") && text.length < 200,
                    );

                  for (const altText of normalized) {
                    await this.storeMemory(
                      altText,
                      {
                        conversationId: completionId,
                        timestamp: Date.now().toString(),
                        category,
                        isNormalized: "true",
                        originalText: summaryText,
                      },
                      completionId,
                      userSettings,
                    );
                  }
                } catch (e) {
                  logger.error("Failed to process normalized memory", {
                    error: e,
                    response: normalizer.response,
                  });
                }
              } catch (e) {
                logger.error("Failed to normalize memory", { error: e });
              }
            }

            events.push({ type: "store", text: summaryText, category });
          }
        }
      } catch (e) {
        logger.error("Memory classification failed", { error: e });
      }
    }

    if (userSettings?.memories_chat_history_enabled) {
      try {
        const userCount = messages.filter((m) => m.role === "user").length;

        if (userCount > 0 && userCount % 5 === 0) {
          const recent = (await conversationManager.get(completionId)).slice(-10);
          const snippet = toProviderMessages(recent)
            .map(
              (m) =>
                `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`,
            )
            .join("\n");

          const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(
            this.env,
            this.user,
          );
          const provider = getChatProvider(providerToUse, {
            env: this.env,
            user: this.user,
          });
          const chatContext =
            this.serviceContext ?? createServiceContext({ env: this.env, user: this.user });

          const summaryResp = await provider.getResponse(
            {
              model: modelToUse,
              env: this.env,
              context: chatContext,
              messages: [
                {
                  role: "system",
                  content: getMemorySummariserPrompt(),
                },
                { role: "user", content: snippet },
              ],
            },
            this.user?.id,
          );
          const text = summaryResp.response?.trim();

          if (text) {
            const category = "snapshot";

            try {
              await this.storeMemory(
                text,
                {
                  conversationId: completionId,
                  timestamp: Date.now().toString(),
                  category,
                },
                completionId,
                userSettings,
              );
              events.push({ type: "snapshot", text, category });
            } catch (e) {
              logger.error("Failed to store snapshot", { error: e });
            }
          }
        }
      } catch (e) {
        logger.error("Snapshot generation failed", { error: e });
      }
    }

    return events;
  }
}

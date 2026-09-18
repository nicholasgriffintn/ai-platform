import {
  buildMemoryClassifierPrompt,
  buildMemoryNormaliserPrompt,
  buildMemorySummariserPrompt,
} from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { z } from "zod/v4";

import { ai } from "~/lib/ai";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getMemoryProvider } from "~/lib/providers/capabilities/memory";
import type { MemoryProviderId } from "~/lib/providers/capabilities/memory/types";
import { recordProjectAudit } from "~/services/audit";
import { toProviderMessages } from "~/services/chat/messages/provider-mapping";
import type { ConversationManager } from "~/services/conversations/manager";
import { getAuxiliaryModel } from "~/services/models/resolve";
import type { IEnv, IUser, IUserSettings, MemoryScope, Message } from "~/types";

const logger = getLogger({ prefix: "services/memory/manager" });

const memoryClassificationSchema = z.object({
  storeMemory: z.boolean().optional(),
  category: z.string().optional(),
  summary: z.string().optional(),
});

const memoryAlternativesSchema = z.object({
  alternatives: z.array(z.string()).optional(),
});

const NORMALISED_MEMORY_CATEGORIES = new Set(["fact", "schedule", "preference"]);
const NORMALISED_MEMORY_MAX_LENGTH = 200;

function cleanNormalisedMemories(alternatives: string[] | undefined): string[] {
  return (alternatives ?? [])
    .map((text) => text.trim())
    .filter(
      (text) =>
        text.length > 0 &&
        !text.includes("###") &&
        !text.includes("**") &&
        text.length < NORMALISED_MEMORY_MAX_LENGTH,
    );
}

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

  public async storeMemory(
    text: string,
    metadata: Record<string, string>,
    conversationId?: string,
    userSettings?: IUserSettings,
    operationId?: string,
    documentId?: string,
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
      operationId,
      documentId,
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

  public async retrieveMemories(
    query: string,
    opts?: {
      topK?: number;
      scoreThreshold?: number;
      userSettings?: IUserSettings | null;
    },
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

  public async handleMemory(
    lastUser: string,
    messages: Message[],
    conversationManager: ConversationManager,
    completionId: string,
    userSettings: IUserSettings,
    operationPrefix: string,
  ): Promise<MemoryEvent[]> {
    const events: MemoryEvent[] = [];

    if (userSettings?.memories_save_enabled) {
      try {
        if (lastUser.trim()) {
          const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(
            this.env,
            this.user,
          );
          const scope = {
            env: this.env,
            user: this.user,
            model: modelToUse,
            provider: providerToUse,
          };
          const { object: classification } = await ai.generateObject({
            ...scope,
            system: buildMemoryClassifierPrompt(),
            prompt: lastUser,
            schema: memoryClassificationSchema,
            name: "memory_classification",
          });

          if (classification.storeMemory) {
            const summaryText = classification.summary || lastUser;
            const category = classification.category || "general";

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
              `${operationPrefix}:classified`,
            );

            if (NORMALISED_MEMORY_CATEGORIES.has(category)) {
              try {
                const { object: normalised } = await ai.generateObject({
                  ...scope,
                  system: buildMemoryNormaliserPrompt(),
                  prompt: summaryText,
                  schema: memoryAlternativesSchema,
                  name: "memory_alternatives",
                });

                for (const [index, altText] of cleanNormalisedMemories(
                  normalised.alternatives,
                ).entries()) {
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
                    `${operationPrefix}:normalised:${index}`,
                  );
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
          const text = (
            await ai.generateText({
              env: this.env,
              user: this.user,
              model: modelToUse,
              provider: providerToUse,
              system: buildMemorySummariserPrompt(),
              prompt: snippet,
            })
          ).trim();

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
                `${operationPrefix}:snapshot`,
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

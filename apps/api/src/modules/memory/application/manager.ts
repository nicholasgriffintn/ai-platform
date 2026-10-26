import { buildMemoryClassifierPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { z } from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getMemoryProvider } from "~/infrastructure/providers/capabilities/memory";
import type { MemoryProviderId } from "~/infrastructure/providers/capabilities/memory/types";
import { gateMemoryClassification } from "~/modules/memory/application/gate";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import { recordProjectAudit } from "~/modules/workspaces/application/audit";
import type { IEnv, IUser, IUserSettings, MemoryScope } from "~/types";

const logger = getLogger({ prefix: "services/memory/manager" });

const memoryClassificationSchema = z.object({
  storeMemory: z.boolean().optional(),
  category: z.string().optional(),
  summary: z.string().optional(),
});

export interface MemoryEvent {
  type: "store";
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
      ? await getRequestUserSettings(this.serviceContext)
      : undefined;

    if (providerId && !userSettings && providerId !== "documents") {
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
      userSettings?: IUserSettings | null;
    },
  ): Promise<Array<{ text: string; score: number }>> {
    const userSettings =
      opts?.userSettings ??
      (this.serviceContext ? await getRequestUserSettings(this.serviceContext) : undefined);
    const provider = getMemoryProvider({
      env: this.env,
      user: this.user,
      userSettings,
      serviceContext: this.serviceContext,
      memoryScope: this.memoryScope,
    });

    return provider.retrieveMemories(query, {
      topK: opts?.topK,
      userSettings,
    });
  }

  public async handleMemory(
    lastUser: string,
    completionId: string,
    userSettings: IUserSettings,
    operationPrefix: string,
  ): Promise<MemoryEvent[]> {
    const events: MemoryEvent[] = [];

    if (userSettings?.memories_save_enabled) {
      try {
        const gate = lastUser.trim()
          ? await gateMemoryClassification({
              env: this.env,
              user: this.user,
              message: lastUser,
              completionId,
            })
          : null;

        if (gate && !gate.proceed) {
          logger.debug("Memory gate skipped classification", {
            probability: gate.probability,
          });
        }

        if (gate?.proceed) {
          const {
            model: modelToUse,
            provider: providerToUse,
            effort,
          } = await getAuxiliaryModel(this.env, this.user);
          const scope = {
            env: this.env,
            user: this.user,
            model: modelToUse,
            provider: providerToUse,
            reasoning_effort: effort,
            disable_functions: true,
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
              },
              completionId,
              userSettings,
              `${operationPrefix}:classified`,
            );

            events.push({ type: "store", text: summaryText, category });
          }
        }
      } catch (e) {
        logger.error("Memory classification failed", { error: e });
      }
    }

    return events;
  }
}

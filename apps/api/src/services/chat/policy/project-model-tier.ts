import {
  DEFAULT_MODEL_TIER,
  modelTierSchema,
  type ComputeSite,
  type ModelTier,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { resolveChatProjectAccess } from "~/services/workspaces/chatProjectAccess";
import type { CoreChatOptions } from "~/types";

export interface ConversationModelSelection {
  conversationExists: boolean;
  modelId?: string;
  modelTier?: ModelTier;
}

export async function resolveAccountDefaultComputeSite(
  context: ServiceContext,
): Promise<ComputeSite | undefined> {
  return (await context.getUserSettings())?.default_compute_site ?? undefined;
}

export async function resolveConversationModelSelection(
  options: Pick<CoreChatOptions, "context" | "completion_id" | "metadata">,
): Promise<ConversationModelSelection> {
  const context = options.context;

  if (!context || !options.completion_id) {
    return { conversationExists: false };
  }

  const conversation = await context.repositories.conversations.getConversation(
    options.completion_id,
  );

  if (!conversation) {
    return { conversationExists: false };
  }

  const user = context.user ?? context.requireUser();
  const isPersonalConversation = !conversation.project_id;

  if (isPersonalConversation && conversation.user_id !== user.id) {
    return { conversationExists: true };
  }

  if (!isPersonalConversation) {
    await resolveChatProjectAccess(context, options);
  }

  const parsedTier = modelTierSchema.safeParse(conversation.model_tier);

  return {
    conversationExists: true,
    modelId: typeof conversation.model_id === "string" ? conversation.model_id : undefined,
    modelTier: parsedTier.success ? parsedTier.data : undefined,
  };
}

export async function resolveProjectDefaultModelTier(
  context: ServiceContext,
  projectId: string | undefined,
): Promise<ModelTier> {
  if (!projectId) {
    return DEFAULT_MODEL_TIER;
  }

  const project = await context.repositories.workspaces.getProject(projectId);

  return project?.default_model_tier ?? DEFAULT_MODEL_TIER;
}

export async function resolveProjectModelTier(
  options: Pick<
    CoreChatOptions,
    "context" | "completion_id" | "metadata" | "model_tier" | "model" | "models"
  >,
): Promise<ModelTier> {
  if (options.model_tier) {
    return options.model_tier;
  }

  if (options.model || options.models?.length || !options.context) {
    return DEFAULT_MODEL_TIER;
  }

  const storedSelection = await resolveConversationModelSelection(options);

  if (storedSelection.modelTier) {
    return storedSelection.modelTier;
  }

  const access = await resolveChatProjectAccess(options.context, options);

  if (access?.project.default_model_tier) {
    return access.project.default_model_tier;
  }

  const settings = await options.context.getUserSettings();

  return settings?.default_model_tier ?? DEFAULT_MODEL_TIER;
}

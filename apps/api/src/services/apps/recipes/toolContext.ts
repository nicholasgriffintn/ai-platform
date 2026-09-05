import {
  parseChatRequestOptions,
  readRecipeChatRequestOptions,
  type ConversationChannelRequestOptions,
} from "@ngriffin_uk/polychat-schemas";

export interface ActiveRecipeSetup {
  id: string;
  installationId?: string;
}

export function getRecipeAllowedConnectorProviders(options: unknown): string[] | null {
  const recipe = readRecipeChatRequestOptions(options);

  if (!recipe) {
    return null;
  }

  return recipe.allowedConnectorProviders ?? [];
}

export function getRecipeAllowedConnectorOperations(
  options: unknown,
  provider: string,
): string[] | null {
  const recipe = readRecipeChatRequestOptions(options);

  if (!recipe) {
    return null;
  }

  return recipe.allowedConnectorOperations?.[provider] ?? [];
}

export function getRecipeExecutionChannel(options: unknown): string | undefined {
  return readRecipeChatRequestOptions(options)?.channel;
}

export function getRecipeConfiguration(options: unknown): Record<string, unknown> | undefined {
  return readRecipeChatRequestOptions(options)?.configuration;
}

export function getActiveRecipeSetup(options: unknown): ActiveRecipeSetup | undefined {
  const recipe = readRecipeChatRequestOptions(options);

  if (!recipe) {
    return undefined;
  }

  return {
    id: recipe.id,
    installationId: recipe.installationId,
  };
}

export function getTriggerRecipeChannel(options: unknown): "sms" | "tool" {
  return parseChatRequestOptions(options)?.channel?.id ?? "tool";
}

export function getRecipeExecutionChannelContext(
  options: unknown,
): ConversationChannelRequestOptions | undefined {
  const channel = parseChatRequestOptions(options)?.channel;

  if (!channel) {
    return undefined;
  }

  return {
    id: channel.id,
    ...(channel.from ? { from: channel.from } : {}),
    ...(channel.to ? { to: channel.to } : {}),
  };
}

export function isRecipeExecutionRequest(options: {
  conversation_type?: string;
  options?: unknown;
}): boolean {
  return (
    options.conversation_type === "task" && Boolean(readRecipeChatRequestOptions(options.options))
  );
}

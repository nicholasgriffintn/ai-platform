import type { EngineRequest } from "@ngriffin_uk/polychat-schemas";

export type ChatRequestOptions = Partial<EngineRequest>;

export function mergeChatRequestOptions(
  base: ChatRequestOptions | undefined,
  override: ChatRequestOptions | undefined,
): ChatRequestOptions | undefined {
  if (!base && !override) {
    return undefined;
  }

  const hasNestedOptions = base?.options !== undefined || override?.options !== undefined;
  const hasMetadata = base?.metadata !== undefined || override?.metadata !== undefined;

  return {
    ...base,
    ...override,
    ...(hasMetadata ? { metadata: { ...base?.metadata, ...override?.metadata } } : {}),
    ...(hasNestedOptions ? { options: { ...base?.options, ...override?.options } } : {}),
  };
}

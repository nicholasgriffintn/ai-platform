import type { ChatSettings } from "~/types";

type ChatCompactionMode = NonNullable<ChatSettings["compaction"]>;

type RequestGenerationSettings = Omit<
  ChatSettings,
  "compaction" | "enabled_tools" | "localOnly" | "tool_options"
> & {
  compaction?: ChatCompactionMode;
};

export interface ChatRequestSettingsProjection {
  enabledTools?: string[];
  generationSettings: RequestGenerationSettings;
  hostedToolOptions?: ChatSettings["tool_options"];
}

function isChatCompactionMode(value: unknown): value is ChatCompactionMode {
  return value === "auto" || value === "off";
}

function hasDefinedValue(value: Record<string, unknown> | undefined): boolean {
  return Boolean(value && Object.values(value).some((item) => item !== undefined));
}

export function projectChatRequestSettings(
  chatSettings: ChatSettings,
): ChatRequestSettingsProjection {
  const {
    compaction,
    enabled_tools: enabledTools,
    localOnly: _localOnly,
    tool_options: hostedToolOptions,
    ...generationSettings
  } = chatSettings;

  return {
    enabledTools,
    generationSettings: {
      ...generationSettings,
      ...(isChatCompactionMode(compaction) ? { compaction } : {}),
    },
    hostedToolOptions: hasDefinedValue(hostedToolOptions) ? hostedToolOptions : undefined,
  };
}

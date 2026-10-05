import { resolveToolEffectClass, type ToolEffects } from "@ngriffin_uk/polychat-library-tools";
import type { ToolEffectClass } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

const RECORDED_MEMORY_TOOL_NAME = "memory";

export function resolveToolCallEffectClass(params: {
  toolName: string;
  effects: ToolEffects<Record<string, unknown>> | undefined;
  rawArguments: unknown;
}): ToolEffectClass {
  if (params.toolName === RECORDED_MEMORY_TOOL_NAME) {
    return "draft";
  }

  const parsed =
    typeof params.rawArguments === "string"
      ? safeParseJson(params.rawArguments)
      : params.rawArguments;

  return resolveToolEffectClass(params.effects, isRecord(parsed) ? parsed : {});
}

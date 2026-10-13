import z from "zod/v4";

export const TOOL_EFFECT_CLASSES = [
  "read",
  "draft",
  "write",
  "external_send",
  "spend",
  "destructive",
  "credential",
  "data_export",
] as const;

export const toolEffectClassSchema = z
  .enum(TOOL_EFFECT_CLASSES)
  .describe(
    "What a tool call changes. read changes nothing that persists. draft creates or changes content only in the caller's own space until they share it. write changes shared or external state. The remaining classes send to people, spend money, delete irreversibly, handle credentials or move data out.",
  );

export type ToolEffectClass = z.infer<typeof toolEffectClassSchema>;

export const NEVER_STANDING_TOOL_EFFECT_CLASSES = [
  "external_send",
  "spend",
  "destructive",
  "credential",
  "data_export",
] as const satisfies readonly ToolEffectClass[];

const neverStandingEffectClasses: ReadonlySet<ToolEffectClass> = new Set(
  NEVER_STANDING_TOOL_EFFECT_CLASSES,
);

export function isNeverStandingEffectClass(effectClass: ToolEffectClass): boolean {
  return neverStandingEffectClasses.has(effectClass);
}

export const UNDECLARED_TOOL_EFFECT_CLASS: ToolEffectClass = "write";

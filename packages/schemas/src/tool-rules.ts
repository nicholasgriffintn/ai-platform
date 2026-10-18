import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const TOOL_RULE_LEVELS = ["act", "act_if_asked", "ask", "hand_off"] as const;

export const toolRuleLevelSchema = z
  .enum(TOOL_RULE_LEVELS)
  .describe(
    "act runs without asking; act_if_asked runs without asking only on turns the owner started; ask always asks first; hand_off never runs and leaves the step to the owner. Workspace-required approvals and sends, spending, deletes, credentials and exports still ask.",
  );

export type ToolRuleLevel = z.infer<typeof toolRuleLevelSchema>;

export const TOOL_RULE_LIMIT = 100;

export const toolRuleSchema = z.object({
  toolName: z.string().trim().min(1).max(200),
  level: toolRuleLevelSchema,
});

export type ToolRule = z.infer<typeof toolRuleSchema>;

export const toolRulesSchema = z
  .array(toolRuleSchema)
  .max(TOOL_RULE_LIMIT)
  .refine(
    (rules) => new Set(rules.map((rule) => rule.toolName)).size === rules.length,
    "Each tool may have one rule",
  );

export function parseToolRules(value: unknown): ToolRule[] {
  const candidate: unknown = typeof value === "string" ? safeParseJson(value) : value;
  const parsed = toolRulesSchema.safeParse(candidate);

  return parsed.success ? parsed.data : [];
}

export function findToolRule(
  rules: readonly ToolRule[] | undefined,
  toolName: string,
): ToolRuleLevel | null {
  const target = toolName.trim().toLowerCase();

  return rules?.find((rule) => rule.toolName.trim().toLowerCase() === target)?.level ?? null;
}

export function activeToolRules(
  rules: readonly ToolRule[] | undefined,
  actingSuspended: boolean | undefined,
): ToolRule[] {
  return (rules ?? []).filter(
    (rule) => !actingSuspended || (rule.level !== "act" && rule.level !== "act_if_asked"),
  );
}

export function withToolRule(
  rules: readonly ToolRule[],
  toolName: string,
  level: ToolRuleLevel | null,
): ToolRule[] {
  const others = rules.filter((rule) => rule.toolName !== toolName);

  return level === null ? others : [...others, { toolName, level }];
}

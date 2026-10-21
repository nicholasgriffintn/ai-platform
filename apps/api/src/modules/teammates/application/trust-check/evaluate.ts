import {
  toolReceiptSchema,
  type TeammateTrustCheckCase,
  type TeammateTrustCheckReport,
  type ToolEffectClass,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, safeParseJson } from "@ngriffin_uk/polychat-utility-core";

const HARMLESS_EFFECTS = new Set<ToolEffectClass>(["read", "draft"]);

function readMessageData(message: Record<string, unknown>): Record<string, unknown> | null {
  const data =
    typeof message.data === "string" ? safeParseJson<unknown>(message.data) : message.data;

  return isRecord(data) ? data : null;
}

export function collectAttemptedEffects(
  messages: readonly Record<string, unknown>[],
): TeammateTrustCheckCase["attemptedEffects"] {
  return messages.flatMap((message) => {
    const data = readMessageData(message);
    const receipt = data?.dryRun === true ? toolReceiptSchema.safeParse(data.receipt) : null;

    return receipt?.success && !HARMLESS_EFFECTS.has(receipt.data.effect)
      ? [{ tool: receipt.data.tool, effect: receipt.data.effect }]
      : [];
  });
}

export function summariseTrustCheck(
  cases: readonly TeammateTrustCheckCase[],
  checkedAt: string,
): TeammateTrustCheckReport {
  return {
    checkedAt,
    passed: cases.filter((trustCase) => trustCase.passed).length,
    failed: cases.filter((trustCase) => !trustCase.passed && !trustCase.error).length,
    errored: cases.filter((trustCase) => trustCase.error !== null).length,
    cases: [...cases],
  };
}

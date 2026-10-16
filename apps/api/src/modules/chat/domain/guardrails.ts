import { formatConjunctionList } from "@ngriffin_uk/polychat-utility-core";

const SETTINGS_HINT = "change the safety check in Account settings › Guardrails";

export function describeGuardrailBlock(
  source: "input" | "output",
  reasons: readonly string[],
): string {
  const unique = [...new Set(reasons)];
  const flagged =
    unique.length > 0
      ? `The safety check flagged it for ${formatConjunctionList(unique)}.`
      : "The safety check flagged it without giving a reason.";

  return source === "input"
    ? `I didn't send that message to the model. ${flagged} If that looks wrong, try rewording it, or ${SETTINGS_HINT}.`
    : `I held that reply back. ${flagged} Try asking a different way, or ${SETTINGS_HINT}.`;
}

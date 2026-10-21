import { isSpendCapReached } from "@ngriffin_uk/polychat-ai-billing";
import type { SpendLedger, TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { readSpendLedger } from "~/modules/usage/application/spend-ledger";

import { requireOwnedTeammateContext } from "./contexts";

const MICROS_PER_CREDIT = 1_000_000;

export async function getTeammateContextSpend(
  context: ServiceContext,
  contextId: string,
): Promise<SpendLedger> {
  const teammateContext = await requireOwnedTeammateContext(context, contextId);

  return readSpendLedger(context, {
    teammateContextId: teammateContext.id,
    capCreditMicros: teammateContext.monthlyCreditCapMicros,
  });
}

export async function updateTeammateContextBudget(
  context: ServiceContext,
  contextId: string,
  monthlyCreditCapMicros: number | null,
): Promise<TeammateContext> {
  await requireOwnedTeammateContext(context, contextId);

  const updated = await context.repositories
    .get(TeammateContextRepository)
    .updateMonthlyCreditCap(contextId, monthlyCreditCapMicros);

  if (!updated) {
    throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}

export async function assertTeammateContextWithinBudget(
  context: ServiceContext,
  teammateContext: Pick<TeammateContext, "id" | "monthlyCreditCapMicros">,
): Promise<void> {
  if (!teammateContext.monthlyCreditCapMicros) {
    return;
  }

  const ledger = await readSpendLedger(context, {
    teammateContextId: teammateContext.id,
    capCreditMicros: teammateContext.monthlyCreditCapMicros,
  });

  if (!isSpendCapReached(ledger.creditMicros, ledger.capCreditMicros)) {
    return;
  }

  throw new AssistantError(
    `This teammate has used its monthly budget of ${formatCredits(
      teammateContext.monthlyCreditCapMicros / MICROS_PER_CREDIT,
    )} credits. Raise the cap in its settings or wait until the month resets.`,
    ErrorType.RATE_LIMIT_ERROR,
    429,
    { teammateContextId: teammateContext.id, spend: ledger },
  );
}

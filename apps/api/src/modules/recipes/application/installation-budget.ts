import { isSpendCapReached } from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { SpendLedger } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TemplateRepository } from "~/modules/templates/infrastructure/TemplateRepository";
import { readSpendLedger } from "~/modules/usage/application/spend-ledger";

import { syncRecipeComposioTriggerStatus } from "./composio-trigger-lifecycle";
import { getRecipeInstallationRecord } from "./index";
import type { StoredRecipeInstallationData } from "./installation-persistence";

const logger = getLogger({ prefix: "recipes/installation-budget" });
const MICROS_PER_CREDIT = 1_000_000;

export async function getRecipeInstallationSpend(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
}): Promise<SpendLedger | null> {
  const existing = await getRecipeInstallationRecord(params);

  if (!existing) {
    return null;
  }

  return readSpendLedger(params.context, {
    recipeInstallationId: existing.record.id,
    capCreditMicros: existing.data.monthlyCreditCapMicros ?? null,
  });
}

async function pauseInstallationForBudget(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
  data: StoredRecipeInstallationData;
}): Promise<void> {
  const paused: StoredRecipeInstallationData = {
    ...params.data,
    status: "paused",
    pausedReason: "budget",
  };

  await params.context.repositories
    .get(TemplateRepository)
    .updateTemplate(params.installationId, { configuration: paused, status: "paused" });

  try {
    await syncRecipeComposioTriggerStatus({
      context: params.context,
      userId: params.userId,
      installationId: params.installationId,
      enabled: false,
    });
  } catch (error) {
    logger.warn("Failed to disable connector triggers for a routine over budget", {
      installationId: params.installationId,
      error,
    });
  }
}

export async function assertRecipeInstallationWithinBudget(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
}): Promise<void> {
  const existing = await getRecipeInstallationRecord(params);
  const cap = existing?.data.monthlyCreditCapMicros;

  if (!existing || !cap) {
    return;
  }

  const ledger = await readSpendLedger(params.context, {
    recipeInstallationId: existing.record.id,
    capCreditMicros: cap,
  });

  if (!isSpendCapReached(ledger.creditMicros, cap)) {
    return;
  }

  if (existing.data.status === "active") {
    await pauseInstallationForBudget({
      context: params.context,
      userId: params.userId,
      installationId: existing.record.id,
      data: existing.data,
    });
  }

  throw new AssistantError(
    `This routine has used its monthly budget of ${formatCredits(
      cap / MICROS_PER_CREDIT,
    )} credits and is paused until you raise the cap or the month resets.`,
    ErrorType.RATE_LIMIT_ERROR,
    429,
    { installationId: existing.record.id, spend: ledger },
  );
}

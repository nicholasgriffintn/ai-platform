import { isActiveModel, type ModelConfigItem, type Readiness } from "@ngriffin_uk/polychat-schemas";

import type { IUser } from "~/types";

const MODEL_READINESS_TTL_MS = 60_000;

function readiness(
  state: Readiness["state"],
  reasonCode: Readiness["reasonCode"],
  reason: string,
  now: Date,
  action?: Readiness["action"],
): Readiness {
  return {
    protocolVersion: 1,
    state,
    reasonCode,
    reason,
    checkedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MODEL_READINESS_TTL_MS).toISOString(),
    ...(action ? { action } : {}),
  };
}

export function resolveModelReadiness(
  model: ModelConfigItem,
  user?: Pick<IUser, "id" | "plan_id">,
  now = new Date(),
): Readiness {
  if (!isActiveModel(model)) {
    return readiness(
      "unavailable",
      "model_unavailable",
      model.deprecationMessage || "This model is no longer available. Choose another model.",
      now,
      { kind: "choose_model", label: "Choose model" },
    );
  }

  if (model.isExecutable) {
    return readiness(
      "ready",
      "ready",
      "This model can start a run under the current account and provider policy.",
      now,
    );
  }

  if (!user?.id) {
    return readiness(
      "setup_required",
      "account_required",
      "Sign in before using this model.",
      now,
      { kind: "sign_in", label: "Sign in" },
    );
  }

  if (model.isPlatformEnabled === false && model.isByokEnabled !== true) {
    return readiness(
      "setup_required",
      "credential_required",
      `Add credentials for ${model.provider} before using this model.`,
      now,
      {
        kind: "configure_provider",
        label: "Open providers",
        path: "/profile?tab=providers",
      },
    );
  }

  if (user.plan_id !== "pro" && !model.isFree && !model.isByokEnabled) {
    return readiness(
      "setup_required",
      "plan_required",
      "This model requires Pro or your own provider credentials.",
      now,
      { kind: "upgrade", label: "See plans", path: "/pricing" },
    );
  }

  return readiness(
    "unknown",
    "check_failed",
    "This model's current account and provider readiness could not be confirmed. Refresh the model list before sending.",
    now,
    { kind: "retry", label: "Refresh models" },
  );
}

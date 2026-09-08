import {
  READINESS_PROTOCOL_VERSION,
  isActiveModel,
  type ModelConfigItem,
  type Readiness,
  requiresPaidPlan,
} from "@ngriffin_uk/polychat-schemas";

import type { IUser } from "~/types";

const MODEL_READINESS_TTL_MS = 60_000;

export const MODEL_RUNTIME_READINESS_STATUSES = [
  "not_configured",
  "unreachable",
  "model_missing",
  "model_loading",
  "machine_offline",
  "desktop_required",
] as const;

export type ModelRuntimeReadinessStatus = (typeof MODEL_RUNTIME_READINESS_STATUSES)[number];

export interface ModelReadinessOptions {
  runtimeStatus?: ModelRuntimeReadinessStatus;
  agentWorkspaceConfigured?: boolean;
}

function readiness(
  state: Readiness["state"],
  reasonCode: Readiness["reasonCode"],
  reason: string,
  now: Date,
  action?: Readiness["action"],
): Readiness {
  return {
    protocolVersion: READINESS_PROTOCOL_VERSION,
    state,
    reasonCode,
    reason,
    checkedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MODEL_READINESS_TTL_MS).toISOString(),
    ...(action ? { action } : {}),
  };
}

export function resolveRuntimeReadiness(
  model: Pick<ModelConfigItem, "matchingModel" | "name" | "provider">,
  status: ModelRuntimeReadinessStatus,
  now = new Date(),
): Readiness {
  const modelName = model.name || model.matchingModel;
  const runtimeName = model.provider ? `${model.provider} runtime` : "device runtime";

  switch (status) {
    case "not_configured":
      return readiness(
        "setup_required",
        "runtime_not_configured",
        `Set up the ${runtimeName} before using ${modelName}.`,
        now,
        { kind: "open_runtimes", label: "Set up", path: "/downloads" },
      );
    case "unreachable":
      return readiness(
        "unavailable",
        "runtime_unreachable",
        `The ${runtimeName} is not responding. Check that it is running before trying again.`,
        now,
        { kind: "open_runtimes", label: "Check again", path: "/downloads" },
      );
    case "model_missing":
      return readiness(
        "unavailable",
        "runtime_model_missing",
        `${modelName} is no longer available in the ${runtimeName}. Install it again or choose another model.`,
        now,
        { kind: "open_runtimes", label: "Open runtimes", path: "/downloads" },
      );
    case "model_loading":
      return readiness(
        "unknown",
        "runtime_model_loading",
        `${modelName} is loading into memory and should be ready shortly.`,
        now,
        { kind: "retry", label: "Check again" },
      );
    case "machine_offline":
      return readiness(
        "unavailable",
        "machine_offline",
        `The machine running ${modelName} is offline. Open Polychat on that machine to use it.`,
        now,
        { kind: "open_on_machine", label: "Open on machine" },
      );
    case "desktop_required":
      return readiness(
        "setup_required",
        "desktop_required",
        `${modelName} runs on a desktop runtime. Install the desktop app to use it.`,
        now,
        { kind: "install_desktop", label: "Install desktop", path: "/downloads" },
      );
  }

  const unreachableStatus: never = status;

  throw new Error(`Unsupported model runtime readiness status: ${String(unreachableStatus)}`);
}

export function resolveModelReadiness(
  model: ModelConfigItem,
  user?: Pick<IUser, "id" | "plan_id">,
  now = new Date(),
  options: ModelReadinessOptions = {},
): Readiness {
  if (options.runtimeStatus) {
    return resolveRuntimeReadiness(model, options.runtimeStatus, now);
  }

  if (!isActiveModel(model)) {
    return readiness(
      "unavailable",
      "model_unavailable",
      model.deprecationMessage || "This model is no longer available. Choose another model.",
      now,
      { kind: "choose_model", label: "Choose model" },
    );
  }

  if (model.kind === "agent" && !options.agentWorkspaceConfigured) {
    const workspaceAction =
      model.agent?.workspace?.kind === "repository"
        ? { kind: "connect_repository" as const, label: "Connect a repository" }
        : { kind: "choose_directory" as const, label: "Choose a directory" };

    return readiness(
      "setup_required",
      "agent_workspace_required",
      "Choose a workspace before starting this agent.",
      now,
      workspaceAction,
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

  if (user.plan_id !== "pro" && requiresPaidPlan(model)) {
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

import type { ComposerBannerDescriptor } from "@ngriffin_uk/polychat-component-conversation";
import { isReadinessFresh, type ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export function buildModelReadinessBanner(
  requestedModelId: string | null,
  model: ModelConfigItem | undefined,
  isLoading: boolean,
  now = new Date(),
): ComposerBannerDescriptor | null {
  if (!requestedModelId || isLoading) {
    return null;
  }

  if (!model) {
    return {
      id: "selected-model-missing",
      tone: "critical",
      title: "Choose another model",
      message:
        "Your selected model is no longer available to this account. It was not replaced automatically.",
    };
  }

  const readiness = model.readiness;

  if (!readiness) {
    return model.isExecutable === false
      ? {
          id: `model-not-executable:${model.id || requestedModelId}`,
          tone: "critical",
          title: "This model cannot run",
          message: "Choose another model or review your provider access before sending.",
        }
      : null;
  }

  if (!isReadinessFresh(readiness, now)) {
    return {
      id: `model-readiness-stale:${model.id || requestedModelId}`,
      tone: "warning",
      title: "Model readiness needs refreshing",
      message: "Open the model selector or retry sending to refresh account and provider access.",
    };
  }

  if (readiness.state === "ready") {
    return null;
  }

  return {
    id: `model-readiness:${model.id || requestedModelId}:${readiness.reasonCode}`,
    tone: readiness.state === "unknown" ? "warning" : "critical",
    title: readiness.state === "unknown" ? "Model readiness is unknown" : "This model cannot run",
    message: readiness.reason,
    ...(readiness.action?.path
      ? { action: { label: readiness.action.label, to: readiness.action.path } }
      : {}),
  };
}

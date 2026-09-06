import { isReadinessFresh, type ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export function isModelSubmissionBlocked(
  requestedModelId: string | null,
  model: ModelConfigItem | undefined,
  isLoading: boolean,
): boolean {
  if (!requestedModelId) {
    return false;
  }

  if (isLoading || !model) {
    return true;
  }

  if (model.readiness && !isReadinessFresh(model.readiness)) {
    return false;
  }

  return (
    model.isExecutable === false || Boolean(model.readiness && model.readiness.state !== "ready")
  );
}

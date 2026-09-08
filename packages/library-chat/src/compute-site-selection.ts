import {
  isBrowserModel,
  runsOnDevice,
  type ComputeSite,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";

export interface ComputeSiteResolution {
  computeSite: ComputeSite;
  modelId?: string;
  reason?: string;
}

export function resolveComputeSiteForClient(options: {
  requestedSite: ComputeSite;
  requestedModel?: ModelConfigItem;
  requestedModelId?: string;
  hasDesktopBackend: boolean;
  hasBrowserRuntime: boolean;
}): ComputeSiteResolution {
  const { requestedSite, requestedModel, requestedModelId, hasDesktopBackend, hasBrowserRuntime } =
    options;

  if (requestedSite === "hosted") {
    return { computeSite: "hosted", modelId: requestedModelId };
  }

  if (
    requestedSite === "browser" &&
    requestedModel &&
    isBrowserModel(requestedModel) &&
    hasBrowserRuntime
  ) {
    return { computeSite: "browser", modelId: requestedModelId };
  }

  if (
    requestedSite === "device" &&
    requestedModel &&
    runsOnDevice(requestedModel) &&
    hasDesktopBackend
  ) {
    return { computeSite: "device", modelId: requestedModelId };
  }

  if (requestedSite === "machine" && requestedModel?.machineId) {
    return { computeSite: "machine", modelId: requestedModelId };
  }

  const canKeepHostedModel =
    requestedModel && !isBrowserModel(requestedModel) && !runsOnDevice(requestedModel);

  return {
    computeSite: "hosted",
    modelId: canKeepHostedModel ? requestedModelId : undefined,
    reason:
      requestedSite === "browser"
        ? "Browser compute is not ready on this client. Using hosted compute instead."
        : requestedSite === "device"
          ? "Device compute is not ready on this client. Using hosted compute instead."
          : "Connected-machine compute is not ready on this client. Using hosted compute instead.",
  };
}

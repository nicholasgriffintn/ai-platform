import type { ModelSource, ModelSourceReadiness } from "@ngriffin_uk/polychat-component-models";
import {
  HOSTED_ENDPOINT_ID,
  MODEL_TIERS,
  type DesktopEndpoint,
  type DesktopRuntimeReadiness,
  type DiscoveredModel,
} from "@ngriffin_uk/polychat-schemas";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";

export function readinessOf(
  readiness: DesktopRuntimeReadiness | undefined,
  checking: boolean,
): ModelSourceReadiness {
  if (checking) {
    return "checking";
  }

  if (!readiness) {
    return "unknown";
  }

  return readiness.status === "ready" ? "ready" : "unavailable";
}

function hintFor(readiness: DesktopRuntimeReadiness | undefined): string | undefined {
  if (readiness?.status === "unauthorised") {
    return "Needs authorisation";
  }

  return undefined;
}

export function buildModelSources({
  endpoints,
  readiness,
  models,
  checking,
  signedIn,
}: {
  endpoints: DesktopEndpoint[];
  readiness: Record<string, DesktopRuntimeReadiness>;
  models: Record<string, DiscoveredModel[]>;
  checking: string | null;
  signedIn: boolean;
}): ModelSource[] {
  const device = endpoints
    .filter((endpoint) => endpoint.kind === "model")
    .map((endpoint) => ({
      id: endpoint.id,
      label: endpoint.label,
      location: "device" as const,
      readiness: readinessOf(readiness[endpoint.id], checking === endpoint.id),
      hint: hintFor(readiness[endpoint.id]),
      entries: (models[endpoint.id] ?? []).map((model) => ({
        id: model.nativeId,
        label: model.displayName,
        detail: model.contextTokens
          ? `${formatCompactCount(model.contextTokens)} context`
          : undefined,
      })),
    }));

  return [
    ...device,
    {
      id: HOSTED_ENDPOINT_ID,
      label: "Cloud",
      location: "cloud",
      readiness: signedIn ? "ready" : "unavailable",
      hint: signedIn ? undefined : "Sign in to use cloud models",
      entries: MODEL_TIERS.map((tier) => ({ id: tier, label: tier })),
    },
  ];
}

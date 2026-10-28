import {
  agentModelConfig,
  agentRuntimeVendorSchema,
  type ModelConfig,
  type Readiness,
} from "@ngriffin_uk/polychat-schemas";

import type { DesktopBackend } from "./desktop-backend.js";

export async function discoverAgentModels(
  backend: Pick<DesktopBackend, "probeAgentTool">,
): Promise<ModelConfig> {
  const entries = await Promise.allSettled(
    Object.entries(agentModelConfig).map(async ([id, model]) => {
      if (model.runsOn !== "device") {
        return [];
      }

      const driver = agentRuntimeVendorSchema.parse(model.matchingModel);
      const probe = await backend.probeAgentTool(driver);

      if (probe.state === "missing") {
        return [];
      }

      const ready = probe.state === "ready";
      const metered = probe.state === "ready" && probe.billing === "api_key";
      const readiness: Readiness = {
        protocolVersion: 1,
        state: ready ? "ready" : "setup_required",
        reasonCode: metered
          ? "agent_metered"
          : ready
            ? "ready"
            : probe.state === "signed_out"
              ? "agent_signed_out"
              : "check_failed",
        reason: metered
          ? `The ${model.name} CLI is signed in with an API key, so every run bills per token. Sign it in with your subscription to use your plan instead.`
          : ready
            ? "Choose a working folder once and this conversation keeps using it."
            : probe.state === "signed_out"
              ? `Sign in with the ${model.name} CLI, then refresh the model list.`
              : `Update and configure the ${model.name} CLI before starting a run.`,
        checkedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        ...(ready && !metered
          ? {}
          : {
              action: {
                kind: "open_runtimes" as const,
                label: "Open runtimes",
                path: "/profile?tab=runtimes",
              },
            }),
      };

      return [[id, { ...model, id, isExecutable: ready, readiness }]];
    }),
  );

  return Object.fromEntries(
    entries.flatMap((entry) => (entry.status === "fulfilled" ? entry.value : [])),
  );
}

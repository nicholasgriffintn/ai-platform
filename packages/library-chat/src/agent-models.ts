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
      const readiness: Readiness = {
        protocolVersion: 1,
        state: ready ? "ready" : "setup_required",
        reasonCode: ready
          ? "ready"
          : probe.state === "signed_out"
            ? "agent_signed_out"
            : "check_failed",
        reason: ready
          ? "Choose a working folder when you send your message."
          : probe.state === "signed_out"
            ? `Sign in with the ${model.name} CLI, then refresh the model list.`
            : `Update and configure the ${model.name} CLI before starting a run.`,
        checkedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        ...(ready
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

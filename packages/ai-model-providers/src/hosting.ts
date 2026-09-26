import type { HostDeploymentInput, HostedDeployment } from "./types.js";

export function hostedFromInput(input: HostDeploymentInput, providerRef: string): HostedDeployment {
  return {
    providerRef,
    spec: input.spec,
    model: input.model,
    adapters: input.adapters,
    desired: "running",
  };
}

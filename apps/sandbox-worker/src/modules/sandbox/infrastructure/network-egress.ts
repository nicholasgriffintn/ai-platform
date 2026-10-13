import {
  SANDBOX_PACKAGE_REGISTRY_HOSTS,
  type ContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import type {
  SandboxCredentialBrokerAccess,
  SandboxTrustLevel,
} from "@ngriffin_uk/polychat-schemas";

import type { WorkspaceEgress } from "./workspace";

export interface SandboxEgressControl {
  start(egress: WorkspaceEgress): Promise<void>;
  setEgressPolicy(policy: ContainerEgressPolicy): Promise<void>;
}

export function buildSandboxEgressPolicy(params: {
  trustLevel: SandboxTrustLevel;
  declaredHosts?: readonly string[];
  directGitHubCheckout: boolean;
}): ContainerEgressPolicy {
  if (params.trustLevel === "trusted") {
    return { mode: "all", hosts: [], readOnlyHosts: [] };
  }

  return {
    mode: "list",
    hosts: [...(params.declaredHosts ?? [])],
    readOnlyHosts: [
      ...SANDBOX_PACKAGE_REGISTRY_HOSTS,
      ...(params.directGitHubCheckout ? ["github.com"] : []),
    ],
  };
}

export async function applySandboxEgress(params: {
  sandbox: SandboxEgressControl;
  policy: ContainerEgressPolicy;
  credentialBroker?: SandboxCredentialBrokerAccess;
}): Promise<void> {
  if (!params.credentialBroker) {
    await params.sandbox.setEgressPolicy(params.policy);

    return;
  }

  const broker = new URL(params.credentialBroker.baseUrl);

  await params.sandbox.start({
    policy: params.policy,
    gitBroker: {
      host: broker.hostname,
      pathPrefix: `${broker.pathname.replace(/\/+$/, "")}/git/`,
      grant: params.credentialBroker.grant,
    },
  });
}

export async function takeBlockedEgressRisks(sandbox: {
  takeBlockedEgress(): Promise<string[]>;
}): Promise<string[]> {
  try {
    const hosts = await sandbox.takeBlockedEgress();

    return hosts.length > 0
      ? [
          `Network access was blocked for ${hosts.join(", ")}. Declare required hosts in networkHosts.`,
        ]
      : [];
  } catch (error) {
    console.warn("[sandbox-egress] Failed to read blocked hosts", {
      error: error instanceof Error ? error.message : String(error),
    });

    return [];
  }
}

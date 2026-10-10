import {
  containerEgressBlockedResponse,
  decideContainerEgress,
  parseContainerEgressPolicy,
  resolveBackupStorageHost,
  SANDBOX_PACKAGE_REGISTRY_HOSTS,
  type ContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import {
  SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX,
  type SandboxCredentialBrokerAccess,
  type SandboxTrustLevel,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { Env } from "../../../types";
import { createPolychatRequest } from "./polychat-request";

export const EGRESS_POLICY_HANDLER = "egressPolicy";
export const BROKERED_GIT_HANDLER = "brokeredGit";

const BROKERED_GIT_METHODS = new Set(["GET", "POST"]);
const FORWARDED_GIT_HEADERS = [
  "accept",
  "accept-encoding",
  "content-encoding",
  "content-type",
  "git-protocol",
] as const;

const brokeredGitParamsSchema = z.object({
  grant: z.string().min(1),
  pathPrefix: z.string().startsWith(`${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/`),
});

type BrokeredGitParams = z.infer<typeof brokeredGitParamsSchema>;

interface OutboundContext {
  containerId: string;
  params?: unknown;
}

export interface SandboxEgressControl {
  setOutboundHandler(methodName: string, params: ContainerEgressPolicy): Promise<void>;
  setOutboundByHost(hostname: string, methodName: string, params: BrokeredGitParams): Promise<void>;
}

function blockedResponse(reason: string): Response {
  return containerEgressBlockedResponse(
    reason,
    "Add the host to networkHosts in the project's environment configuration if the run needs it.",
  );
}

async function recordBlockedHost(env: Env, containerId: string, host: string): Promise<void> {
  try {
    await env.Sandbox.get(env.Sandbox.idFromString(containerId)).recordBlockedEgress(host);
  } catch (error) {
    console.warn("[sandbox-egress] Failed to record blocked host", {
      host,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function egressPolicyOutbound(
  request: Request,
  env: Env,
  ctx: OutboundContext,
): Promise<Response> {
  const policy = parseContainerEgressPolicy(ctx.params);
  const url = new URL(request.url);
  const decision = policy
    ? decideContainerEgress(policy, { url, method: request.method })
    : { kind: "block" as const, reason: "the run has no network policy" };

  if (decision.kind === "allow") {
    return fetch(request);
  }

  await recordBlockedHost(env, ctx.containerId, url.hostname);

  return blockedResponse(decision.reason);
}

export async function brokeredGitOutbound(
  request: Request,
  env: Env,
  ctx: OutboundContext,
): Promise<Response> {
  const params = brokeredGitParamsSchema.safeParse(ctx.params);
  const url = new URL(request.url);

  if (
    !params.success ||
    !url.pathname.startsWith(params.data.pathPrefix) ||
    !BROKERED_GIT_METHODS.has(request.method.toUpperCase())
  ) {
    await recordBlockedHost(env, ctx.containerId, url.hostname);

    return blockedResponse(`only repository git traffic may reach ${url.hostname}`);
  }

  const headers = new Headers();

  for (const name of FORWARDED_GIT_HEADERS) {
    const value = request.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("Authorization", `Bearer ${params.data.grant}`);

  return env.POLYCHAT_API.fetch(
    createPolychatRequest(`${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.method.toUpperCase() === "GET" ? undefined : request.body,
    }),
  );
}

export function buildSandboxEgressPolicy(params: {
  env: Env;
  trustLevel: SandboxTrustLevel;
  declaredHosts?: readonly string[];
  directGitHubCheckout: boolean;
}): ContainerEgressPolicy {
  if (params.trustLevel === "trusted") {
    return { mode: "all", hosts: [], readOnlyHosts: [] };
  }

  const storageHost = resolveBackupStorageHost(params.env);

  return {
    mode: "list",
    hosts: [...(storageHost ? [storageHost] : []), ...(params.declaredHosts ?? [])],
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
  await params.sandbox.setOutboundHandler(EGRESS_POLICY_HANDLER, params.policy);

  if (!params.credentialBroker) {
    return;
  }

  const broker = new URL(params.credentialBroker.baseUrl);

  await params.sandbox.setOutboundByHost(broker.hostname, BROKERED_GIT_HANDLER, {
    grant: params.credentialBroker.grant,
    pathPrefix: `${broker.pathname.replace(/\/+$/, "")}/git/`,
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

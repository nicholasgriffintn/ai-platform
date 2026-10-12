import {
  agentHostBlockedResponse,
  decideContainerEgress,
  parseContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import { INTERNAL_SERVICE_AUTHORIZATION_HEADER } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Env } from "../types";
import type { AgentHost } from "./agent-host-container";

interface OutboundContext {
  containerId?: string;
  params?: unknown;
}

type AgentHostOutboundSandbox = {
  recordBlockedEgress?: (host: string) => Promise<void>;
};

export interface PolychatApiParams {
  serviceToken: string;
}

const EGRESS_FORWARDED_HEADERS = [
  "accept",
  "accept-encoding",
  "accept-language",
  "content-encoding",
  "content-type",
  "user-agent",
] as const;

export async function polychatApiOutbound(
  request: Request,
  env: Env,
  ctx: OutboundContext,
): Promise<Response> {
  const targetUrl = new URL(request.url);

  targetUrl.protocol = "http:";
  targetUrl.hostname = "polychat-api";
  targetUrl.port = "";
  const serviceToken = isRecord(ctx.params) ? ctx.params.serviceToken : undefined;

  if (typeof serviceToken !== "string" || !serviceToken) {
    throw new Error("Agent host service authentication is not configured");
  }

  const forwardedRequest = new Request(targetUrl, request);

  forwardedRequest.headers.delete("Authorization");
  forwardedRequest.headers.delete("Cookie");
  forwardedRequest.headers.set(INTERNAL_SERVICE_AUTHORIZATION_HEADER, `Bearer ${serviceToken}`);

  return env.POLYCHAT_API.fetch(forwardedRequest);
}

async function recordBlockedHost(
  sandbox: AgentHostOutboundSandbox | undefined,
  env: Env,
  containerId: string | undefined,
  host: string,
): Promise<void> {
  try {
    if (sandbox?.recordBlockedEgress) {
      await sandbox.recordBlockedEgress(host);

      return;
    }

    if (containerId && env.AgentHost) {
      const stub = env.AgentHost.get(env.AgentHost.idFromString(containerId)) as unknown as
        | AgentHost
        | undefined;

      await stub?.recordBlockedEgress(host);
    }
  } catch (error) {
    console.warn("[agent-host] Failed to record blocked host", {
      host,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function agentHostEgressOutbound(
  request: Request,
  env: Env,
  ctx: OutboundContext,
): Promise<Response> {
  const policy = parseContainerEgressPolicy(ctx.params);
  const url = new URL(request.url);
  const decision = policy
    ? decideContainerEgress(policy, { url, method: request.method })
    : { kind: "block" as const, reason: "the agent host has no network policy" };

  if (decision.kind !== "allow") {
    await recordBlockedHost(undefined, env, ctx.containerId, url.hostname);

    return agentHostBlockedResponse(decision.reason);
  }

  const headers = new Headers();

  for (const name of EGRESS_FORWARDED_HEADERS) {
    const value = request.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer().catch(() => undefined);
  const sanitised = new Request(url, {
    method: request.method,
    headers,
    ...(body === undefined ? {} : { body, duplex: "half" as const }),
    redirect: "follow",
  });

  return fetch(sanitised);
}

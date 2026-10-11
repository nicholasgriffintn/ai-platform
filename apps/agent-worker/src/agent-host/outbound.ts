import {
  containerEgressBlockedResponse,
  decideContainerEgress,
  parseContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import { INTERNAL_SERVICE_AUTHORIZATION_HEADER } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Env } from "../types";

interface OutboundContext {
  params?: unknown;
}

export interface PolychatApiParams {
  serviceToken: string;
}

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
  forwardedRequest.headers.set(INTERNAL_SERVICE_AUTHORIZATION_HEADER, `Bearer ${serviceToken}`);

  return env.POLYCHAT_API.fetch(forwardedRequest);
}

export async function agentHostEgressOutbound(
  request: Request,
  _env: Env,
  ctx: OutboundContext,
): Promise<Response> {
  const policy = parseContainerEgressPolicy(ctx.params);
  const decision = policy
    ? decideContainerEgress(policy, { url: new URL(request.url), method: request.method })
    : { kind: "block" as const, reason: "the agent host has no network policy" };

  return decision.kind === "allow"
    ? fetch(request)
    : containerEgressBlockedResponse(
        decision.reason,
        "Hosted agents can read package registries and access Polychat only.",
      );
}

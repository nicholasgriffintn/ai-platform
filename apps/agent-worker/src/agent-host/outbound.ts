import {
  containerEgressBlockedResponse,
  decideContainerEgress,
  parseContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Env } from "../types";

interface OutboundContext {
  params?: unknown;
}

export interface PolychatApiParams {
  apiKey: string;
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
  const apiKey =
    isRecord(ctx.params) && typeof ctx.params.apiKey === "string" ? ctx.params.apiKey : undefined;
  const forwardedRequest = new Request(targetUrl, request);

  if (apiKey) {
    forwardedRequest.headers.set("Authorization", `Bearer ${apiKey}`);
  } else {
    forwardedRequest.headers.delete("Authorization");
  }

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

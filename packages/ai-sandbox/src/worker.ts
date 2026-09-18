import { decideOutbound, type OutboundGatewayProps } from "@ngriffin_uk/polychat-library-sandbox";
import { WorkerEntrypoint } from "cloudflare:workers";

import { dispatchToolRequest } from "./tool-invocations.js";

export class OutboundGateway extends WorkerEntrypoint<unknown, OutboundGatewayProps> {
  async fetch(request: Request): Promise<Response> {
    const decision = decideOutbound(this.ctx.props, new URL(request.url));

    switch (decision.kind) {
      case "allow":
        return fetch(request);
      case "tool":
        return dispatchToolRequest(this.ctx.props.invocationId, decision.tool, request);
      default:
        return Response.json(
          { ok: false, error: { code: "network_blocked", message: decision.reason } },
          { status: 403 },
        );
    }
  }
}

import { errorResponse } from "@ngriffin_uk/polychat-library-sandbox";

import { handleAgentHostRequest, isAgentHostPath } from "./agent-host/routes";
import { INTERNAL_COMPUTER_ORIGIN } from "./config/app";
import { handleComputerRequest } from "./lifecycle";
import { handleScreenRequest } from "./screen";
import { handleSiteVerification } from "./site-verification";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.origin !== INTERNAL_COMPUTER_ORIGIN) {
      return handleScreenRequest(request, env);
    }

    if (request.method !== "POST") {
      return errorResponse(405, "Method not allowed");
    }

    if (isAgentHostPath(url.pathname)) {
      return handleAgentHostRequest(request, env);
    }

    if (!url.pathname.startsWith("/computer/")) {
      return errorResponse(404, "Not found");
    }

    if (url.pathname === "/computer/site-verify") {
      return handleSiteVerification(request, env);
    }

    return handleComputerRequest(request, env);
  },
};

export { ContainerProxy, Sandbox as Computer } from "@cloudflare/sandbox";
export { AgentHost } from "./agent-host/agent-host-container";

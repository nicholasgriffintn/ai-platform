import { ContainerProxy } from "@cloudflare/sandbox";
import { errorResponse } from "@ngriffin_uk/polychat-library-sandbox";

import { handleAgentHostRequest, isAgentHostPath } from "./agent-host/routes";
import type { Env } from "./types";

const INTERNAL_AGENT_ORIGIN = "https://agent.internal";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.origin !== INTERNAL_AGENT_ORIGIN) {
      return errorResponse(404, "Not found");
    }

    if (request.method !== "POST") {
      return errorResponse(405, "Method not allowed");
    }

    if (!isAgentHostPath(url.pathname)) {
      return errorResponse(404, "Not found");
    }

    return handleAgentHostRequest(request, env);
  },
};

export { ContainerProxy };
export { AgentHost } from "./agent-host/agent-host-container";

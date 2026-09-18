import { errorResponse } from "@ngriffin_uk/polychat-library-sandbox";

import { INTERNAL_COMPUTER_ORIGIN } from "./config/app";
import { handleComputerRequest } from "./lifecycle";
import { handleScreenRequest } from "./screen";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.origin !== INTERNAL_COMPUTER_ORIGIN) {
      return handleScreenRequest(request, env);
    }

    if (!url.pathname.startsWith("/computer/")) {
      return errorResponse(404, "Not found");
    }

    if (request.method !== "POST") {
      return errorResponse(405, "Method not allowed");
    }

    return handleComputerRequest(request, env);
  },
};

export { Sandbox as Computer } from "@cloudflare/sandbox";

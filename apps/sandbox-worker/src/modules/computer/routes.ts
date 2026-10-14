import { errorResponse } from "@ngriffin_uk/polychat-library-sandbox";

import type { Env } from "../../types";
import { INTERNAL_COMPUTER_ORIGIN } from "./config";
import { handleComputerRequest } from "./lifecycle";
import { handleScreenRequest } from "./screen";
import { handleSiteReference } from "./site-reference";
import { handleSiteVerification } from "./site-verification";

function isScreenHost(url: URL, env: Env): boolean {
  const host = env.COMPUTER_SCREEN_HOST?.trim().toLowerCase();

  return Boolean(host) && url.hostname.toLowerCase().endsWith(`.${host}`);
}

export async function handleComputerTraffic(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);

  if (isScreenHost(url, env)) {
    return handleScreenRequest(request, env);
  }

  if (url.origin !== INTERNAL_COMPUTER_ORIGIN) {
    return null;
  }

  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  if (url.pathname === "/computer/site-verify") {
    return handleSiteVerification(request, env);
  }

  if (url.pathname === "/computer/site-reference") {
    return handleSiteReference(request, env);
  }

  if (!url.pathname.startsWith("/computer/")) {
    return errorResponse(404, "Not found");
  }

  return handleComputerRequest(request, env);
}

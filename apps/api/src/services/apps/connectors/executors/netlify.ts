import { AssistantError, ErrorType } from "~/utils/errors";

import { createConnectorJsonClient } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const NETLIFY_API_BASE_URL = "https://api.netlify.com/api/v1";
const fetchNetlifyJson = createConnectorJsonClient(NETLIFY_API_BASE_URL);

function requireNetlifySiteId(params: Record<string, unknown>): string {
  const siteId = getStringParam(params, "siteId");

  if (!siteId) {
    throw new AssistantError("siteId is required", ErrorType.PARAMS_ERROR, 400);
  }

  return siteId;
}

function requireNetlifyDeployId(params: Record<string, unknown>): string {
  const deployId = getStringParam(params, "deployId");

  if (!deployId) {
    throw new AssistantError("deployId is required", ErrorType.PARAMS_ERROR, 400);
  }

  return deployId;
}

function addNetlifyPagination(url: URL, params: Record<string, unknown>) {
  url.searchParams.set(
    "page",
    String(limitPositiveInteger(getNumberParam(params, "page"), 1, 1000)),
  );
  url.searchParams.set(
    "per_page",
    String(limitPositiveInteger(getNumberParam(params, "perPage"), 20, 100)),
  );
}

export async function executeNetlifyOperation(
  token: string,
  operation: string,
  params: Record<string, unknown>,
) {
  if (operation === "list_sites") {
    const url = new URL("/api/v1/sites", NETLIFY_API_BASE_URL);

    addNetlifyPagination(url, params);

    return fetchNetlifyJson({ path: `${url.pathname}${url.search}`, token });
  }

  if (operation === "list_deploys") {
    const siteId = requireNetlifySiteId(params);
    const url = new URL(
      `/api/v1/sites/${encodeURIComponent(siteId)}/deploys`,
      NETLIFY_API_BASE_URL,
    );

    addNetlifyPagination(url, params);

    return fetchNetlifyJson({ path: `${url.pathname}${url.search}`, token });
  }

  if (operation === "get_deploy") {
    const deployId = requireNetlifyDeployId(params);

    return fetchNetlifyJson({
      path: `/api/v1/deploys/${encodeURIComponent(deployId)}`,
      token,
    });
  }

  throw new AssistantError("Unsupported Netlify operation", ErrorType.PARAMS_ERROR, 400);
}

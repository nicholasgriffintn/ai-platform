import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { composioRequest, type ComposioEnvironment } from "../composio/request.js";
import { readKnowledgeProxyFile } from "./proxy-file.js";

export type KnowledgeProxyRead = (endpoint: string) => Promise<unknown>;

export function createKnowledgeProxyReader(
  env: ComposioEnvironment,
  connectedAccountId: string,
): KnowledgeProxyRead {
  return async (endpoint) => {
    const url = new URL(endpoint);
    const allowed =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname === "www.googleapis.com" &&
      url.pathname.startsWith("/drive/v3/");

    if (!allowed) {
      throw new AssistantError(
        "Knowledge request is outside provider scope",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    const result = await composioRequest<unknown>({
      env,
      path: "/tools/execute/proxy",
      method: "POST",
      maxResponseBytes: 2 * 1024 * 1024,
      body: { connected_account_id: connectedAccountId, endpoint, method: "GET" },
    });

    if (
      !isRecord(result) ||
      typeof result.status !== "number" ||
      result.status < 200 ||
      result.status >= 300
    ) {
      const status =
        isRecord(result) &&
        typeof result.status === "number" &&
        Number.isInteger(result.status) &&
        result.status >= 400 &&
        result.status <= 599
          ? result.status
          : 502;

      throw new AssistantError(
        "Knowledge source request failed",
        status === 403 || status === 401
          ? ErrorType.AUTHORISATION_ERROR
          : ErrorType.EXTERNAL_API_ERROR,
        status,
      );
    }

    return result.binary_data ? readKnowledgeProxyFile(result.binary_data) : result.data;
  };
}

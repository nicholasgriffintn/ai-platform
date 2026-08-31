import { isAbortError } from "~/utils/abort";
import { headersToRecord, readHttpResponseBody, setDefaultHeader } from "~/utils/http";
import { getLogger } from "~/utils/logger";
import { coerceStringRecord, isPlainObject } from "~/utils/objects";
import { appendQueryParams, isPrivateHostname } from "~/utils/urls";

import type { ApiToolDefinition } from "../../types/functions";
import { call_api as call_apiDescriptor } from "./definitions/api_call";

const logger = getLogger({ prefix: "services/functions/api_call" });

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 60000;

export const call_api: ApiToolDefinition = {
  ...call_apiDescriptor,
  execute: async (args, _context) => {
    const urlInput = typeof args?.url === "string" ? args.url.trim() : "";

    if (!urlInput) {
      return {
        status: "error",
        name: "call_api",
        content: "Missing URL for API request",
        data: {},
      };
    }

    let url: URL;

    try {
      url = new URL(urlInput);
    } catch {
      return {
        status: "error",
        name: "call_api",
        content: "Invalid URL format",
        data: {},
      };
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        status: "error",
        name: "call_api",
        content: "Only http and https URLs are supported",
        data: {},
      };
    }

    if (isPrivateHostname(url.hostname)) {
      return {
        status: "error",
        name: "call_api",
        content: "Private or local network URLs are not allowed",
        data: {},
      };
    }

    const requestType = args?.request_type === "graphql" ? "graphql" : "rest";
    const timeoutMsInput = typeof args?.timeout_ms === "number" ? args.timeout_ms : undefined;
    const timeoutMs =
      timeoutMsInput && timeoutMsInput > 0
        ? Math.min(timeoutMsInput, MAX_TIMEOUT_MS)
        : DEFAULT_TIMEOUT_MS;

    const headers = coerceStringRecord(args?.headers);
    const queryParams = isPlainObject(args?.query_params) ? args.query_params : undefined;

    appendQueryParams(url, queryParams);

    let method = "GET";
    let body: string | undefined;

    if (requestType === "graphql") {
      const graphqlQuery = typeof args?.graphql_query === "string" ? args.graphql_query.trim() : "";

      if (!graphqlQuery) {
        return {
          status: "error",
          name: "call_api",
          content: "GraphQL requests require a graphql_query",
          data: {},
        };
      }

      method = "POST";
      const payload = {
        query: graphqlQuery,
        variables: isPlainObject(args?.graphql_variables) ? args.graphql_variables : undefined,
        operationName:
          typeof args?.graphql_operation_name === "string"
            ? args.graphql_operation_name
            : undefined,
      };

      body = JSON.stringify(payload);
      setDefaultHeader(headers, "Content-Type", "application/json");
    } else {
      const methodInput = typeof args?.method === "string" ? args.method.toUpperCase() : undefined;
      const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

      method = allowedMethods.has(methodInput || "") ? methodInput! : methodInput ? "" : "GET";

      if (!method) {
        return {
          status: "error",
          name: "call_api",
          content: "Unsupported HTTP method",
          data: {},
        };
      }

      if (args?.body !== undefined && args?.body !== null) {
        if (method === "GET") {
          return {
            status: "error",
            name: "call_api",
            content: "GET requests do not support a body",
            data: {},
          };
        }

        if (typeof args.body === "string") {
          body = args.body;
        } else if (isPlainObject(args.body) || Array.isArray(args.body)) {
          body = JSON.stringify(args.body);
          setDefaultHeader(headers, "Content-Type", "application/json");
        } else {
          return {
            status: "error",
            name: "call_api",
            content: "Request body must be a string or JSON object",
            data: {},
          };
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body !== undefined) {
        fetchOptions.body = body;
      }

      response = await fetch(url.toString(), fetchOptions);
    } catch (error) {
      logger.error("API request failed", {
        error_message: error instanceof Error ? error.message : "Unknown error",
        url: url.toString(),
      });

      return {
        status: "error",
        name: "call_api",
        content: isAbortError(error) ? "API request timed out" : "API request failed",
        data: {
          url: url.toString(),
          method,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }

    const { body: responseBody, format: bodyFormat, parsed } = await readHttpResponseBody(response);

    const graphqlErrors =
      requestType === "graphql" && isPlainObject(parsed) ? parsed.errors : undefined;

    const statusMessage =
      response.ok && graphqlErrors
        ? "GraphQL request completed with errors"
        : response.ok
          ? "API request completed"
          : `API request failed: ${response.status} ${response.statusText}`;

    return {
      status: response.ok ? "success" : "error",
      name: "call_api",
      content: statusMessage,
      data: {
        url: url.toString(),
        method,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: headersToRecord(response.headers),
        body: responseBody,
        body_format: bodyFormat,
      },
    };
  },
};

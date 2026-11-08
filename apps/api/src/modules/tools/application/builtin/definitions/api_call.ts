import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import type { ToolEffectClass } from "@ngriffin_uk/polychat-schemas";
import { normaliseHttpOrigin } from "@ngriffin_uk/polychat-utility-server/urls";

import type { FunctionToolDescriptor } from "~/types/functions";

function callApiEffectClass(input: {
  request_type?: string;
  method?: string;
  auth?: unknown;
}): ToolEffectClass {
  if (input.auth) {
    return "credential";
  }

  if (input.request_type === "graphql") {
    return "write";
  }

  const method = input.method?.toUpperCase() ?? "GET";

  if (method === "GET") {
    return "read";
  }

  return method === "DELETE" ? "destructive" : "write";
}

export const call_api: FunctionToolDescriptor = {
  name: "call_api",
  description:
    "Calls a REST or GraphQL API and returns a structured response. Use this when you need to fetch data from external APIs.",
  type: "normal",
  permissions: ["network", "write"],
  companionTools: ["request_secret"],
  effects: {
    effectClass: callApiEffectClass,
    destination: (input) => normaliseHttpOrigin(input.url) ?? undefined,
  },
  intentEvidence: (input) => {
    const destination = normaliseHttpOrigin(input.url);

    return {
      operation: "call_api",
      requestType: input.request_type ?? "rest",
      method: input.method ?? "GET",
      ...(input.auth ? { credential: "secret reference" } : {}),
      ...(destination ? { destination } : {}),
    };
  },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      request_type: {
        type: "string",
        description: "The request type: 'rest' or 'graphql'",
        enum: ["rest", "graphql"],
        default: "rest",
      },
      url: {
        type: "string",
        description: "The full URL of the API endpoint",
      },
      method: {
        type: "string",
        description:
          "HTTP method for REST requests (defaults to GET or POST when a body is supplied)",
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      },
      headers: {
        type: "object",
        description:
          'Optional non-secret headers to include in the request (example: {"Accept":"application/json"}). Use auth for API keys and tokens.',
      },
      auth: {
        type: "object",
        description:
          "Send a secret the user provided through request_secret. The reference only works for the origin the user approved and is spent once that origin responds; a request that fails before any response leaves it usable. Redirects are not followed. Never put raw secrets in headers.",
        properties: {
          secret_ref: {
            type: "string",
            description: "The secret-ref:<hex> reference from the user's reply.",
          },
          header: {
            type: "string",
            description: "Header that carries the secret (defaults to Authorization).",
          },
          scheme: {
            type: "string",
            enum: ["bearer", "raw"],
            description: "bearer sends 'Bearer <secret>'; raw sends the secret as is.",
          },
        },
        required: ["secret_ref"],
      },
      query_params: {
        type: "object",
        description:
          'Optional query parameters as key-value pairs (example: {"q":"search term","page":2})',
      },
      body: {
        type: "object",
        description: 'JSON body for REST requests (example: {"id":123,"name":"Ada"})',
      },
      graphql_query: {
        type: "string",
        description: "GraphQL query string (required for graphql)",
      },
      graphql_variables: {
        type: "object",
        description: "GraphQL variables object (optional)",
      },
      graphql_operation_name: {
        type: "string",
        description: "GraphQL operation name (optional)",
      },
      timeout_ms: {
        type: "number",
        description: "Timeout in milliseconds (max 60000)",
        minimum: 1000,
      },
    },
    required: ["url"],
  }),
};

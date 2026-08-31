import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const call_api: FunctionToolDescriptor = {
  name: "call_api",
  description:
    "Calls a REST or GraphQL API and returns a structured response. Use this when you need to fetch data from external APIs.",
  type: "normal",
  costPerCall: 0,
  permissions: ["network"],
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
          'Optional headers to include in the request (example: {"Authorization":"Bearer <token>","Accept":"application/json"})',
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

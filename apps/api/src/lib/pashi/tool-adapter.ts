import type { IFunctionResponse } from "~/types";

import { searchPashiTools } from "./catalog";
import type { PashiClient } from "./client";
import { PashiClientError } from "./client";
import type { PashiOperation, PashiToolType } from "./contracts";

export async function searchPashiCatalog(
  client: PashiClient,
  args: Record<string, unknown>,
): Promise<IFunctionResponse> {
  const toolTypes = normaliseToolTypes(args.tool_types);

  if (toolTypes.length === 0) {
    return pashiErrorResponse(
      "search_pashi_tools",
      "invalid_input",
      "Pass at least one tool_types value: generator or converter.",
    );
  }

  try {
    const info = await client.getInfo();
    const limit =
      typeof args.limit === "number" && Number.isInteger(args.limit)
        ? Math.max(1, Math.min(args.limit, 25))
        : 10;
    const results = searchPashiTools({
      limit,
      query: typeof args.query === "string" ? args.query : undefined,
      toolTypes,
      tools: info.tools,
    });

    return {
      status: "success",
      name: "search_pashi_tools",
      content: `Found ${results.length} matching Pashi tool${results.length === 1 ? "" : "s"}. Use only executable tools and pass the documented fields to run_pashi_tools.`,
      data: {
        catalogueName: info.name,
        query: args.query,
        results,
        toolTypes,
        totalTools: info.tools.length,
      },
    };
  } catch (error) {
    return toPashiErrorResponse("search_pashi_tools", error);
  }
}

export async function runPashiOperations(
  client: PashiClient,
  args: Record<string, unknown>,
): Promise<IFunctionResponse> {
  if (!Array.isArray(args.operations) || args.operations.length === 0) {
    return pashiErrorResponse(
      "run_pashi_tools",
      "invalid_input",
      "Pass at least one Pashi operation.",
    );
  }

  const stopOnError = args.stop_on_error !== false;
  const results: Array<Record<string, unknown>> = [];

  for (const [index, value] of args.operations.entries()) {
    const operation = parsePashiOperation(value);

    if (!operation) {
      results.push({
        index,
        status: "error",
        error: {
          code: "invalid_input",
          message: "Each Pashi operation requires a valid tool_id and string fields.",
        },
      });
      if (stopOnError) {
        break;
      }

      continue;
    }

    try {
      const result = await client.execute(operation);

      results.push({
        index,
        status: "success",
        ...result,
      });
    } catch (error) {
      results.push({
        index,
        status: "error",
        toolId: operation.toolId,
        error: getPashiErrorDetails(error),
      });
      if (stopOnError) {
        break;
      }
    }
  }

  const completed = results.filter((result) => result.status === "success").length;
  const failed = results.filter((result) => result.status === "error").length;

  return {
    status: failed === 0 ? "success" : "error",
    name: "run_pashi_tools",
    content:
      failed === 0
        ? `Completed ${completed} Pashi operation${completed === 1 ? "" : "s"} in order.`
        : `Completed ${completed} Pashi operation${completed === 1 ? "" : "s"}; ${failed} failed.`,
    data: {
      completed,
      failed,
      results,
      stoppedEarly: results.length < args.operations.length,
    },
  };
}

function normaliseToolTypes(value: unknown): PashiToolType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((item): item is PashiToolType => item === "generator" || item === "converter"),
    ),
  );
}

function parsePashiOperation(value: unknown): PashiOperation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.tool_id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(record.tool_id)) {
    return null;
  }

  if (record.input !== undefined && typeof record.input !== "string") {
    return null;
  }

  if (
    record.fields !== undefined &&
    (!record.fields || typeof record.fields !== "object" || Array.isArray(record.fields))
  ) {
    return null;
  }

  const rawFields = (record.fields ?? {}) as Record<string, unknown>;

  if (Object.values(rawFields).some((field) => typeof field !== "string")) {
    return null;
  }

  return {
    toolId: record.tool_id,
    ...(typeof record.input === "string" ? { input: record.input } : {}),
    fields: rawFields as Record<string, string>,
  };
}

function getPashiErrorDetails(error: unknown): { code: string; message: string; status?: number } {
  if (error instanceof PashiClientError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.status !== undefined ? { status: error.status } : {}),
    };
  }

  return {
    code: "upstream_error",
    message: "Pashi request failed.",
  };
}

function pashiErrorResponse(name: string, code: string, message: string): IFunctionResponse {
  return {
    status: "error",
    name,
    content: message,
    data: {
      error: {
        code,
        message,
      },
    },
  };
}

function toPashiErrorResponse(name: string, error: unknown): IFunctionResponse {
  const details = getPashiErrorDetails(error);

  return pashiErrorResponse(name, details.code, details.message);
}

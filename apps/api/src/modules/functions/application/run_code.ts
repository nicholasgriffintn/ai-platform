import type { EvaluateResult } from "@ngriffin_uk/polychat-ai-sandbox";
import { isSandboxError } from "@ngriffin_uk/polychat-library-sandbox";

import { evaluateWithTools, resolveEvaluator } from "~/modules/evaluate/application";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { RUN_CODE_TOOL_NAME, run_code as run_codeDescriptor } from "./definitions/run_code";

interface RunCodeArgs {
  code: string;
  tools?: string[];
  network?: string[];
  timeout_ms?: number;
}

const MAX_CONTENT_CHARS = 8_000;

function clip(text: string): string {
  return text.length > MAX_CONTENT_CHARS ? `${text.slice(0, MAX_CONTENT_CHARS)}\n…` : text;
}

function formatLogs(result: EvaluateResult): string {
  return result.logs.map((entry) => `[${entry.level}] ${entry.message}`).join("\n");
}

function describeResult(result: EvaluateResult): IFunctionResponse {
  const logs = formatLogs(result);
  const shared = {
    logs: result.logs,
    toolCalls: result.toolCalls,
    durationMs: result.durationMs,
  };

  if (result.ok === false) {
    return {
      status: "error",
      name: RUN_CODE_TOOL_NAME,
      content: clip(
        [`${result.error.name}: ${result.error.message}`, logs].filter(Boolean).join("\n\n"),
      ),
      data: { ok: false, error: result.error, ...shared },
    };
  }

  const value = typeof result.value === "string" ? result.value : JSON.stringify(result.value);

  return {
    status: "success",
    name: RUN_CODE_TOOL_NAME,
    content: clip([value ?? "null", logs ? `Logs:\n${logs}` : ""].filter(Boolean).join("\n\n")),
    data: { ok: true, value: result.value, ...shared },
  };
}

export const run_code: ApiToolDefinition = {
  ...run_codeDescriptor,
  execute: async (args: RunCodeArgs, context) => {
    const evaluator = resolveEvaluator({
      env: context.env,
      outboundGateway: context.request.context?.outboundGateway,
    });

    if (!evaluator) {
      return {
        status: "error",
        name: RUN_CODE_TOOL_NAME,
        content: "Code execution is not available in this environment",
        data: {},
      };
    }

    try {
      return describeResult(
        await evaluateWithTools({
          evaluator,
          context,
          code: args.code,
          toolNames: args.tools ?? [],
          network: args.network ?? [],
          timeoutMs: args.timeout_ms,
          excludeTool: RUN_CODE_TOOL_NAME,
        }),
      );
    } catch (error) {
      if (isSandboxError(error)) {
        return {
          status: "error",
          name: RUN_CODE_TOOL_NAME,
          content: error.message,
          data: { code: error.code, ...error.details },
        };
      }

      throw error;
    }
  },
};

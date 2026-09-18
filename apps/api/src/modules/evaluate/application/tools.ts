import {
  createCodeMode,
  type EvaluateResult,
  type Evaluator,
} from "@ngriffin_uk/polychat-ai-sandbox";
import { SandboxError } from "@ngriffin_uk/polychat-library-sandbox";
import { toToolDeclaration } from "@ngriffin_uk/polychat-library-tools";

import {
  functionToolCatalogue,
  handleFunctions,
  type RegisteredFunctionTool,
} from "~/modules/functions/application";
import type { IFunctionResponse } from "~/types";
import type { ApiToolExecutionContext } from "~/types/functions";

const NON_SCRIPTABLE_PERMISSIONS = new Set(["human", "orchestration", "delegate"]);

export interface EvaluateWithToolsOptions {
  evaluator: Evaluator;
  context: ApiToolExecutionContext;
  code: string;
  toolNames: readonly string[];
  network: readonly string[];
  timeoutMs?: number;
  excludeTool: string;
}

function isScriptableTool(tool: RegisteredFunctionTool, excludeTool: string): boolean {
  return (
    tool.name !== excludeTool &&
    !(tool.permissions ?? []).some((permission) => NON_SCRIPTABLE_PERMISSIONS.has(permission))
  );
}

function resolveScriptableTools(
  toolNames: readonly string[],
  excludeTool: string,
): RegisteredFunctionTool[] {
  return toolNames.map((name) => {
    const tool = functionToolCatalogue.find(name);

    if (!tool || !isScriptableTool(tool, excludeTool)) {
      throw new SandboxError("tool_unavailable", `Tool "${name}" cannot be used from code`, {
        toolName: name,
      });
    }

    return tool;
  });
}

function unwrapToolResponse(response: IFunctionResponse): unknown {
  if (response.status === "error") {
    throw new Error(
      typeof response.content === "string" ? response.content : "The tool reported an error",
    );
  }

  return { content: response.content ?? null, data: response.data ?? null };
}

export async function evaluateWithTools(
  options: EvaluateWithToolsOptions,
): Promise<EvaluateResult> {
  const tools = resolveScriptableTools(options.toolNames, options.excludeTool);
  const { context } = options;
  const codeMode = createCodeMode(options.evaluator, {
    tools: tools.map((tool) => {
      const declaration = toToolDeclaration(tool);

      return {
        name: declaration.function.name,
        description: declaration.function.description,
        inputSchema: declaration.function.parameters,
      };
    }),
    invoke: async (name, args) =>
      unwrapToolResponse(
        await handleFunctions({
          completion_id: context.completionId,
          app_url: context.appUrl,
          functionName: name,
          args,
          request: context.request,
          conversationManager: context.conversationManager,
        }),
      ),
    network: options.network.length > 0 ? options.network : "none",
    timeoutMs: options.timeoutMs,
  });

  return codeMode.run(options.code, { signal: context.abortSignal });
}

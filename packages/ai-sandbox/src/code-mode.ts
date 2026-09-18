import {
  DEFAULT_TOOLS_BINDING,
  describeToolsForModel,
  type CodeModeToolDescription,
} from "@ngriffin_uk/polychat-library-sandbox";

import type { EvaluateOptions, EvaluateResult, Evaluator, ToolInvoker } from "./types.js";

export interface CodeModeOptions {
  tools: readonly CodeModeToolDescription[];
  invoke: ToolInvoker;
  binding?: string;
  network?: EvaluateOptions["network"];
  timeoutMs?: number;
}

export type CodeModeRunOptions = Omit<EvaluateOptions, "script" | "tools" | "isolation">;

export interface CodeMode {
  instructions(): string;
  run(script: string, options?: CodeModeRunOptions): Promise<EvaluateResult>;
}

export function codeModeInstructions(
  tools: readonly CodeModeToolDescription[],
  binding = DEFAULT_TOOLS_BINDING,
): string {
  return [
    "Write the body of an async JavaScript function and return the final value.",
    `Call tools through the \`${binding}\` object; every call returns a promise, so await it.`,
    "Use console.log for progress you want reported back. Network access is only available to hosts the run allows.",
    "",
    "Available tools:",
    describeToolsForModel(tools, binding),
  ].join("\n");
}

export function createCodeMode(evaluator: Evaluator, options: CodeModeOptions): CodeMode {
  const binding = options.binding ?? DEFAULT_TOOLS_BINDING;

  return {
    instructions: () => codeModeInstructions(options.tools, binding),
    run: (script, runOptions = {}) =>
      evaluator.evaluate({
        network: options.network,
        timeoutMs: options.timeoutMs,
        ...runOptions,
        script,
        tools:
          options.tools.length > 0
            ? { definitions: options.tools, invoke: options.invoke, binding }
            : undefined,
        isolation: "fresh",
      }),
  };
}

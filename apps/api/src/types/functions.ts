import type { ToolDefinition } from "@ngriffin_uk/polychat-schemas";

import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import type { IFunctionResponse } from "~/types";

export type ApiToolDefinition = Omit<
  ToolDefinition<any, IFunctionResponse, ToolExecutionContext>,
  "execute"
> & {
  execute: (input: any, context: ToolExecutionContext) => Promise<IFunctionResponse>;
  maxIdenticalCalls?: number;
  normaliseInput?: (input: unknown) => unknown;
  companionTools?: readonly string[];
};

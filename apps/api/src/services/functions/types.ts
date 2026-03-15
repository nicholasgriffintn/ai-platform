import type { ToolDefinition } from "@assistant/schemas";
import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import type { IFunctionResponse } from "~/types";

export type ApiToolDefinition = Omit<
	ToolDefinition<any, IFunctionResponse, ToolExecutionContext>,
	"execute"
> & {
	execute: (
		input: any,
		context: ToolExecutionContext,
	) => Promise<IFunctionResponse>;
};

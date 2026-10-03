import type { RunnableTool } from "@ngriffin_uk/polychat-schemas";

import { listFunctionToolDefinitions } from "~/modules/functions/application/definitions";
import { NON_RUNNABLE_FUNCTION_TOOLS } from "~/modules/functions/application/internal-tools";
import {
  formatFunctionName,
  getFunctionIcon,
  getFunctionResponseType,
} from "~/modules/tools/application/functions";
import { getToolCategory } from "~/modules/tools/application/toolCategories";
import { buildToolFormSchema } from "~/modules/tools/utils/form-schema";

type FunctionTool = ReturnType<typeof listFunctionToolDefinitions>[number];

export const buildRunnableTool = (tool: FunctionTool): RunnableTool => ({
  id: tool.name,
  name: formatFunctionName(tool.name),
  description: tool.description || `Run the ${tool.name} tool`,
  category: getToolCategory(tool.name),
  icon: getFunctionIcon(tool.name),
  type: tool.type,
  formSchema: buildToolFormSchema(tool.inputSchema, formatFunctionName(tool.name)),
  responseSchema: {
    type: getFunctionResponseType(tool.name),
  },
});

export const getRunnableTool = (id: string): RunnableTool | null => {
  if (NON_RUNNABLE_FUNCTION_TOOLS.has(id)) {
    return null;
  }

  const tool = listFunctionToolDefinitions().find((candidate) => candidate.name === id);

  return tool ? buildRunnableTool(tool) : null;
};

import { FieldType, type ToolFormSchema, type RunnableTool } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { listFunctionTools } from "~/services/functions";
import { getToolCategory } from "~/services/tools/toolCategories";
import {
  formatFunctionName,
  getFunctionIcon,
  getFunctionResponseDisplay,
  getFunctionResponseType,
} from "~/utils/functions";

type FunctionTool = ReturnType<typeof listFunctionTools>[number];
type JsonSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

const mapJsonSchemaTypeToFieldType = (type?: string, hasEnum?: unknown[]): FieldType => {
  if (hasEnum) {
    return FieldType.SELECT;
  }

  switch (type) {
    case "string":
      return FieldType.TEXT;
    case "number":
    case "integer":
      return FieldType.NUMBER;
    case "boolean":
      return FieldType.CHECKBOX;
    default:
      return FieldType.TEXTAREA;
  }
};

const generateValidationFromSchema = (schema: JsonSchemaProperty) => {
  const validation: Record<string, unknown> = {};

  if (schema.enum) {
    validation.options = schema.enum.map((value) => ({
      label: String(value),
      value: String(value),
    }));
  }

  if (schema.minimum !== undefined) {
    validation.min = schema.minimum;
  }

  if (schema.maximum !== undefined) {
    validation.max = schema.maximum;
  }

  if (schema.minLength !== undefined) {
    validation.minLength = schema.minLength;
  }

  if (schema.maxLength !== undefined) {
    validation.maxLength = schema.maxLength;
  }

  if (schema.pattern) {
    validation.pattern = schema.pattern;
  }

  return Object.keys(validation).length > 0 ? validation : undefined;
};

const buildFormSchema = (tool: FunctionTool): ToolFormSchema => {
  const parameters = z.toJSONSchema(tool.inputSchema) as {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  const { properties = {}, required = [] } = parameters;
  const label = formatFunctionName(tool.name);

  return {
    steps: [
      {
        id: "parameters",
        title: "Parameters",
        description: `Provide the parameters for ${label}`,
        fields: Object.entries(properties).map(([key, value]) => ({
          id: key,
          type: mapJsonSchemaTypeToFieldType(value.type, value.enum),
          label: value.title || key,
          description: value.description,
          placeholder: `Enter ${key}`,
          required: required.includes(key),
          validation: generateValidationFromSchema(value),
        })),
      },
    ],
  };
};

export const buildRunnableTool = (tool: FunctionTool): RunnableTool => ({
  id: tool.name,
  name: formatFunctionName(tool.name),
  description: tool.description || `Run the ${tool.name} tool`,
  category: getToolCategory(tool.name),
  icon: getFunctionIcon(tool.name),
  costPerCall: tool.costPerCall,
  isDefault: tool.isDefault || false,
  type: tool.type,
  formSchema: buildFormSchema(tool),
  responseSchema: {
    type: getFunctionResponseType(tool.name),
    display: getFunctionResponseDisplay(tool.name),
  },
});

export const getRunnableTool = (id: string): RunnableTool | null => {
  const tool = listFunctionTools().find((candidate) => candidate.name === id);

  return tool ? buildRunnableTool(tool) : null;
};

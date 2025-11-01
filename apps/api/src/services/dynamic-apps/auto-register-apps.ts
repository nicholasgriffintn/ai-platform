import { availableFunctions } from "~/services/functions";
import type { IFunction } from "~/types";
import type { AppSchema } from "~/types/app-schema";
import { FieldType } from "~/types/app-schema";
import {
  formatFunctionName,
  getFunctionIcon,
  getFunctionResponseDisplay,
  getFunctionResponseType,
} from "~/utils/functions";
import { getLogger } from "~/utils/logger";
import { registerDynamicApp } from "./index";

const logger = getLogger({
  prefix: "services/dynamic-apps/auto-register-apps",
});

export const autoRegisterDynamicApps = (): void => {
  for (const func of availableFunctions) {
    registerFunctionAsDynamicApp(func);
  }
};

const registerFunctionAsDynamicApp = (func: IFunction): void => {
  const { name, description, parameters, type, isDefault, costPerCall } = func;

  const appSchema: AppSchema = {
    id: name,
    name: formatFunctionName(name),
    description: description || `Execute the ${name} function`,
    icon: getFunctionIcon(name),
    category: "Functions",
    type,
    isDefault: isDefault || false,
    costPerCall,
    formSchema: {
      steps: [
        {
          id: "parameters",
          title: "Function Parameters",
          description: `Provide the parameters for the ${formatFunctionName(name)} function`,
          fields: generateFieldsFromParameters(parameters),
        },
      ],
    },
    responseSchema: {
      type: getFunctionResponseType(name),
      display: getFunctionResponseDisplay(name),
    },
  };

  try {
    registerDynamicApp(appSchema);
  } catch (error) {
    logger.error(`Failed to register dynamic app for function ${name}:`, {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

const generateFieldsFromParameters = (
  parameters: any,
): AppSchema["formSchema"]["steps"][0]["fields"] => {
  const fields: AppSchema["formSchema"]["steps"][0]["fields"] = [];

  if (!parameters || !parameters.properties) {
    return fields;
  }

  const { properties, required = [] } = parameters;

  for (const [key, value] of Object.entries(properties) as [string, any][]) {
    const isRequired = required.includes(key);

    const fieldType = mapJsonSchemaTypeToFieldType(value.type, value.enum);

    const field = {
      id: key,
      type: fieldType,
      label: value.title || key,
      description: value.description,
      placeholder: `Enter ${key}`,
      required: isRequired,
      validation: generateValidationFromSchema(value, fieldType),
    };

    fields.push(field);
  }

  return fields;
};

const mapJsonSchemaTypeToFieldType = (
  type: string,
  hasEnum?: any[],
): FieldType => {
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
    case "array":
      return FieldType.MULTISELECT;
    default:
      return FieldType.TEXTAREA;
  }
};

const generateValidationFromSchema = (
  schema: any,
  _fieldType: FieldType,
): any => {
  const validation: any = {};

  if (schema.enum) {
    validation.options = schema.enum.map((value: any) => ({
      label: value.toString(),
      value: value.toString(),
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

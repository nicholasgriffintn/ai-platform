import { FieldType, type ToolFormField, type ToolFormSchema } from "@ngriffin_uk/polychat-schemas";
import { formatUnknownValue } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

type JsonSchemaProperty = z.core.JSONSchema.JSONSchema;

function getJsonSchemaValueFormat(schema: JsonSchemaProperty): ToolFormField["valueFormat"] {
  const variants = [schema, ...(schema.anyOf ?? []), ...(schema.oneOf ?? [])];
  const types = new Set(
    variants.flatMap((variant) => {
      if (typeof variant === "boolean") {
        return [];
      }

      return Array.isArray(variant.type) ? variant.type : [variant.type];
    }),
  );

  if (!types.has("object") && !types.has("array")) {
    return undefined;
  }

  return types.has("string") ? "json-or-text" : "json";
}

function mapJsonSchemaTypeToFieldType(schema: JsonSchemaProperty): FieldType {
  if (schema.enum) {
    return FieldType.SELECT;
  }

  switch (schema.type) {
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
}

function generateValidationFromSchema(schema: JsonSchemaProperty): ToolFormField["validation"] {
  const validation: NonNullable<ToolFormField["validation"]> = {};

  if (schema.enum) {
    const labels = Array.isArray(schema.enumNames) ? schema.enumNames : [];

    validation.options = schema.enum.map((value, index) => ({
      label: typeof labels[index] === "string" ? labels[index] : formatUnknownValue(value),
      value: formatUnknownValue(value),
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
}

export function buildToolFormSchema(inputSchema: z.ZodType, label: string): ToolFormSchema {
  const { properties = {}, required = [] } = z.toJSONSchema(inputSchema);

  return {
    steps: [
      {
        id: "parameters",
        title: "Parameters",
        description: `Provide the parameters for ${label}`,
        fields: Object.entries(properties).map(([key, schema]) => {
          const value = typeof schema === "boolean" ? {} : schema;

          return {
            id: key,
            type: mapJsonSchemaTypeToFieldType(value),
            label: value.title || key,
            description: value.description,
            placeholder: `Enter ${key}`,
            required: required.includes(key),
            valueFormat: getJsonSchemaValueFormat(value),
            validation: generateValidationFromSchema(value),
          };
        }),
      },
    ],
  };
}

import z from "zod/v4";

import { type ResponseDisplay, ResponseDisplayType } from "./functions";

export enum FieldType {
  TEXT = "text",
  NUMBER = "number",
  SELECT = "select",
  MULTISELECT = "multiselect",
  CHECKBOX = "checkbox",
  FILE = "file",
  DATE = "date",
  TEXTAREA = "textarea",
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    options?: Array<{ label: string; value: string }>;
  };
}

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormSchema {
  steps: FormStep[];
}

export interface ResponseSchema {
  type: ResponseDisplayType;
  display: ResponseDisplay;
}

export interface AppSchema {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  formSchema: FormSchema;
  responseSchema: ResponseSchema;
}

export const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum(FieldType),
  label: z.string(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean(),
  defaultValue: z.any().optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      options: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const formStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(formFieldSchema),
});

export const formSchema = z.object({
  steps: z.array(formStepSchema),
});

export const responseFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  format: z.string().optional(),
});

export const responseSchema = z.object({
  type: z.enum(ResponseDisplayType),
  display: z.object({
    fields: z.array(responseFieldSchema).optional(),
    template: z.string().optional(),
  }),
});

export const appSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  category: z.string().optional(),
  formSchema: formSchema,
  responseSchema: responseSchema,
});

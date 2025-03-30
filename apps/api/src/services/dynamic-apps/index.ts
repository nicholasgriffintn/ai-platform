import { ConversationManager } from "../../lib/conversationManager";
import { Database } from "../../lib/database";
import type { AppSchema } from "../../types/app-schema";
import type { IRequest } from "../../types/chat";
import { handleFunctions } from "../functions";

const dynamicApps = new Map<string, AppSchema>();

/**
 * Register a new dynamic app
 * @param app The app schema to register
 * @returns The registered app
 */
export const registerDynamicApp = (app: AppSchema): AppSchema => {
  if (dynamicApps.has(app.id)) {
    throw new Error(`App with ID ${app.id} already exists`);
  }

  dynamicApps.set(app.id, app);
  return app;
};

/**
 * Get all registered dynamic apps
 * @returns Array of all registered apps (basic info only)
 */
export const getDynamicApps = async (): Promise<
  Array<Omit<AppSchema, "formSchema" | "responseSchema">>
> => {
  return Array.from(dynamicApps.values()).map(
    ({ id, name, description, icon, category }) => ({
      id,
      name,
      description,
      icon,
      category,
    }),
  );
};

/**
 * Get a specific dynamic app by ID
 * @param id The app ID
 * @returns The app schema or null if not found
 */
export const getDynamicAppById = async (
  id: string,
): Promise<AppSchema | null> => {
  return dynamicApps.get(id) || null;
};

/**
 * Execute a dynamic app with the provided form data
 * @param id The app ID
 * @param formData The form data submitted by the user
 * @param req The request object
 * @returns The execution result
 */
export const executeDynamicApp = async (
  id: string,
  formData: Record<string, any>,
  req: IRequest,
): Promise<Record<string, any>> => {
  const app = dynamicApps.get(id);

  if (!app) {
    throw new Error(`App with ID ${id} not found`);
  }

  validateFormData(app, formData);

  const { env, user } = req;

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    userId: user?.id,
    store: !!user?.id,
    platform: "dynamic-apps",
  });

  try {
    if (app.category === "Functions") {
      const functionName = app.id;
      const functionResult = await handleFunctions({
        completion_id: req.request?.completion_id || "dynamic-app-execution",
        app_url: req.app_url,
        functionName,
        args: formData,
        request: req,
        conversationManager,
      });

      return {
        success: true,
        data: {
          message: `Successfully executed ${app.name}`,
          timestamp: new Date().toISOString(),
          input: formData,
          result: functionResult,
        },
      };
    }

    return {
      success: false,
    };
  } catch (error) {
    console.error(`Error executing app ${id}:`, error);
    throw error;
  }
};

/**
 * Validate form data against the app's schema
 * @param app The app schema
 * @param formData The form data to validate
 */
const validateFormData = (
  app: AppSchema,
  formData: Record<string, any>,
): void => {
  const fieldIds = app.formSchema.steps.flatMap((step) =>
    step.fields.map((field) => field.id),
  );

  for (const step of app.formSchema.steps) {
    for (const field of step.fields) {
      if (
        field.required &&
        (formData[field.id] === undefined ||
          formData[field.id] === null ||
          formData[field.id] === "")
      ) {
        throw new Error(`Required field ${field.id} is missing`);
      }
    }
  }

  for (const key of Object.keys(formData)) {
    if (!fieldIds.includes(key)) {
      throw new Error(`Unknown field ${key} in form data`);
    }
  }

  for (const step of app.formSchema.steps) {
    for (const field of step.fields) {
      if (formData[field.id] !== undefined) {
        validateField(field, formData[field.id]);
      }
    }
  }
};

/**
 * Validate a single field value against its schema
 * @param field The field schema
 * @param value The field value
 */
const validateField = (
  field: AppSchema["formSchema"]["steps"][0]["fields"][0],
  value: any,
): void => {
  const { type, validation } = field;

  switch (type) {
    case "text":
    case "textarea":
      if (typeof value !== "string") {
        throw new Error(`Field ${field.id} must be a string`);
      }

      if (
        validation?.minLength !== undefined &&
        value.length < validation.minLength
      ) {
        throw new Error(
          `Field ${field.id} must be at least ${validation.minLength} characters`,
        );
      }

      if (
        validation?.maxLength !== undefined &&
        value.length > validation.maxLength
      ) {
        throw new Error(
          `Field ${field.id} must be at most ${validation.maxLength} characters`,
        );
      }

      if (
        validation?.pattern !== undefined &&
        !new RegExp(validation.pattern).test(value)
      ) {
        throw new Error(
          `Field ${field.id} does not match the required pattern`,
        );
      }
      break;

    case "number":
      if (typeof value !== "number") {
        throw new Error(`Field ${field.id} must be a number`);
      }

      if (validation?.min !== undefined && value < validation.min) {
        throw new Error(`Field ${field.id} must be at least ${validation.min}`);
      }

      if (validation?.max !== undefined && value > validation.max) {
        throw new Error(`Field ${field.id} must be at most ${validation.max}`);
      }
      break;

    case "select":
      if (typeof value !== "string") {
        throw new Error(`Field ${field.id} must be a string`);
      }

      if (
        validation?.options &&
        !validation.options.some((option) => option.value === value)
      ) {
        throw new Error(`Field ${field.id} has an invalid option value`);
      }
      break;

    case "multiselect":
      if (!Array.isArray(value)) {
        throw new Error(`Field ${field.id} must be an array`);
      }

      if (validation?.options) {
        const validValues = validation.options.map((option) => option.value);
        for (const item of value) {
          if (!validValues.includes(item)) {
            throw new Error(
              `Field ${field.id} has an invalid option value: ${item}`,
            );
          }
        }
      }
      break;

    case "checkbox":
      if (typeof value !== "boolean") {
        throw new Error(`Field ${field.id} must be a boolean`);
      }
      break;

    case "date":
      if (!(value instanceof Date) && Number.isNaN(Date.parse(value))) {
        throw new Error(`Field ${field.id} must be a valid date`);
      }
      break;

    case "file":
      if (value === undefined) {
        throw new Error(`Field ${field.id} must have a file`);
      }
      break;
  }
};

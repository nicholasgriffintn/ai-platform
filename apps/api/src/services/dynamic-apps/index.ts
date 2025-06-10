import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { DynamicAppResponseRepository } from "~/repositories/DynamicAppResponseRepository";
import { handleFunctions } from "~/services/functions";
import type { AppSchema } from "~/types/app-schema";
import type { IRequest } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "DYNAMIC_APPS" });

const dynamicApps = new Map<string, AppSchema>();

/**
 * Register a new dynamic app
 * @param app The app schema to register
 * @returns The registered app
 */
export const registerDynamicApp = (app: AppSchema): AppSchema => {
  if (dynamicApps.has(app.id)) {
    throw new AssistantError(
      `App with ID ${app.id} already exists`,
      ErrorType.PARAMS_ERROR,
    );
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
    throw new AssistantError(
      `App with ID ${id} not found`,
      ErrorType.NOT_FOUND,
      404,
    );
  }

  validateFormData(app, formData);

  const { env, user } = req;

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    user,
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

      let response_id: string | undefined;
      if (user?.id) {
        const responseRepo = new DynamicAppResponseRepository(env);
        const saved = await responseRepo.createResponse(user.id, id, {
          formData,
          result: functionResult,
        });
        response_id = saved.id;
      }

      return {
        success: true,
        response_id,
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
    logger.error(`Error executing app ${id}:`, { error });
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
        throw new AssistantError(
          `Required field ${field.id} is missing`,
          ErrorType.PARAMS_ERROR,
        );
      }
    }
  }

  for (const key of Object.keys(formData)) {
    if (!fieldIds.includes(key)) {
      throw new AssistantError(
        `Unknown field ${key} in form data`,
        ErrorType.PARAMS_ERROR,
      );
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
        throw new AssistantError(
          `Field ${field.id} must be a string`,
          ErrorType.PARAMS_ERROR,
        );
      }

      if (
        validation?.minLength !== undefined &&
        value.length < validation.minLength
      ) {
        throw new AssistantError(
          `Field ${field.id} must be at least ${validation.minLength} characters`,
          ErrorType.PARAMS_ERROR,
        );
      }

      if (
        validation?.maxLength !== undefined &&
        value.length > validation.maxLength
      ) {
        throw new AssistantError(
          `Field ${field.id} must be at most ${validation.maxLength} characters`,
          ErrorType.PARAMS_ERROR,
        );
      }

      if (
        validation?.pattern !== undefined &&
        !new RegExp(validation.pattern).test(value)
      ) {
        throw new AssistantError(
          `Field ${field.id} does not match the required pattern`,
          ErrorType.PARAMS_ERROR,
        );
      }
      break;

    case "number":
      if (typeof value !== "number") {
        throw new AssistantError(
          `Field ${field.id} must be a number`,
          ErrorType.PARAMS_ERROR,
        );
      }

      if (validation?.min !== undefined && value < validation.min) {
        throw new AssistantError(
          `Field ${field.id} must be at least ${validation.min}`,
          ErrorType.PARAMS_ERROR,
        );
      }

      if (validation?.max !== undefined && value > validation.max) {
        throw new AssistantError(
          `Field ${field.id} must be at most ${validation.max}`,
          ErrorType.PARAMS_ERROR,
        );
      }
      break;

    case "select":
      if (typeof value !== "string") {
        throw new AssistantError(
          `Field ${field.id} must be a string`,
          ErrorType.PARAMS_ERROR,
        );
      }

      if (
        validation?.options &&
        !validation.options.some((option) => option.value === value)
      ) {
        throw new AssistantError(
          `Field ${field.id} has an invalid option value`,
          ErrorType.PARAMS_ERROR,
        );
      }
      break;

    case "multiselect":
      if (!Array.isArray(value)) {
        throw new AssistantError(
          `Field ${field.id} must be an array`,
          ErrorType.PARAMS_ERROR,
        );
      }

      if (validation?.options) {
        const validValues = validation.options.map((option) => option.value);
        for (const item of value) {
          if (!validValues.includes(item)) {
            throw new AssistantError(
              `Field ${field.id} has an invalid option value: ${item}`,
              ErrorType.PARAMS_ERROR,
            );
          }
        }
      }
      break;

    case "checkbox":
      if (typeof value !== "boolean") {
        throw new AssistantError(
          `Field ${field.id} must be a boolean`,
          ErrorType.PARAMS_ERROR,
        );
      }
      break;

    case "date":
      if (!(value instanceof Date) && Number.isNaN(Date.parse(value))) {
        throw new AssistantError(
          `Field ${field.id} must be a valid date`,
          ErrorType.PARAMS_ERROR,
        );
      }
      break;

    case "file":
      if (value === undefined) {
        throw new AssistantError(
          `Field ${field.id} must have a file`,
          ErrorType.PARAMS_ERROR,
        );
      }
      break;
  }
};

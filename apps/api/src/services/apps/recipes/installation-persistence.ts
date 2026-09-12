import {
  recipeConfigurationSchema,
  recipeInstallationTriggerSchema,
  type RecipeConfiguration,
  type RecipeInstallationTrigger,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { TemplateRecord } from "~/repositories/TemplateRepository";
import { safeParseJson } from "~/utils/json";

import type { RecipeScheduleState } from "./scheduleState";

const scheduleStateSchema = z.record(
  z.string(),
  z.object({
    triggerId: z.string().optional(),
    cronExpression: z.string(),
    timezone: z.string().optional(),
    enabled: z.boolean(),
    activatedAt: z.string(),
    lastRunKey: z.string().optional(),
  }),
);

const storedRecipeInstallationDataSchema = z.object({
  recipeId: z.string().min(1),
  status: z.enum(["active", "paused"]).default("active"),
  triggers: z.array(recipeInstallationTriggerSchema).default([]),
  configuration: recipeConfigurationSchema.optional(),
  scheduleState: scheduleStateSchema.optional(),
  teammateContextId: z.string().min(1).optional(),
});

export interface StoredRecipeInstallationData {
  recipeId: string;
  status: "active" | "paused";
  triggers: RecipeInstallationTrigger[];
  configuration?: RecipeConfiguration;
  scheduleState?: RecipeScheduleState;
  teammateContextId?: string;
}

export function parseStoredRecipeInstallationData(
  record: TemplateRecord,
): StoredRecipeInstallationData | null {
  if (record.kind !== "recipe") {
    return null;
  }

  const value =
    typeof record.configuration === "string"
      ? safeParseJson<unknown>(record.configuration)
      : record.configuration;
  const parsed = storedRecipeInstallationDataSchema.safeParse(value);

  return parsed.success && parsed.data.recipeId === record.capability_id ? parsed.data : null;
}

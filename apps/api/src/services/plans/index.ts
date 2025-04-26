import { Database } from "~/lib/database";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function listPlans(env: IEnv) {
  const db = Database.getInstance(env);
  return await db.getAllPlans();
}

export async function getPlanDetails(env: IEnv, id: string) {
  const db = Database.getInstance(env);
  const plan = await db.getPlanById(id);
  if (!plan) {
    throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
  }
  return plan;
}

import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function listPlans(env: IEnv) {
	const repositories = new RepositoryManager(env);
	return await repositories.plans.getAllPlans();
}

export async function getPlanDetails(env: IEnv, id: string) {
	const repositories = new RepositoryManager(env);
	const plan = await repositories.plans.getPlanById(id);
	if (!plan) {
		throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
	}
	return plan;
}

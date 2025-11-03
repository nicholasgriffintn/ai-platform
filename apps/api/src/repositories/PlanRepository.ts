import { BaseRepository } from "./BaseRepository";

export class PlanRepository extends BaseRepository {
	public async getAllPlans(): Promise<Record<string, unknown>[]> {
		const { query, values } = this.buildSelectQuery("plans");
		return this.runQuery<Record<string, unknown>>(query, values);
	}

	public async getPlanById(
		planId: string,
	): Promise<Record<string, unknown> | null> {
		const { query, values } = this.buildSelectQuery("plans", { id: planId });
		return this.runQuery<Record<string, unknown>>(query, values, true);
	}
}

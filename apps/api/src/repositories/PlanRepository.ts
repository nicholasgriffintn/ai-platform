import { BaseRepository } from "./BaseRepository";

export class PlanRepository extends BaseRepository {
  public async getAllPlans(): Promise<Record<string, unknown>[]> {
    const result = await this.runQuery<Record<string, unknown>>(
      "SELECT * FROM plans",
    );
    return result;
  }

  public async getPlanById(
    planId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.runQuery<Record<string, unknown>>(
      "SELECT * FROM plans WHERE id = ?",
      [planId],
      true,
    );
    return result;
  }
}

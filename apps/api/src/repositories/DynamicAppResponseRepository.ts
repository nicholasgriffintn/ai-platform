import type { IEnv } from "~/types";
import type { AppData } from "./AppDataRepository";
import { AppDataRepository } from "./AppDataRepository";

export class DynamicAppResponseRepository {
  private repo: AppDataRepository;

  constructor(env: IEnv) {
    this.repo = new AppDataRepository(env);
  }

  async createResponse(
    userId: number,
    appId: string,
    payload: Record<string, any>,
    itemId?: string,
  ): Promise<AppData> {
    return this.repo.createAppDataWithItem(
      userId,
      appId,
      itemId ?? crypto.randomUUID(),
      "dynamic_app_response",
      payload,
    );
  }

  async getResponseById(responseId: string): Promise<AppData | null> {
    return this.repo.getAppDataById(responseId);
  }

  async getResponseByItemId(itemId: string): Promise<AppData | null> {
    return this.repo.getAppDataByItemId(itemId);
  }

  async listResponsesForUser(
    userId: number,
    appId?: string,
  ): Promise<AppData[]> {
    let data: AppData[];

    if (appId) {
      data = await this.repo.getAppDataByUserAndApp(userId, appId);
    } else {
      data = await this.repo.getAppDataByUser(userId);
    }

    return data.filter((d) => d.item_type === "dynamic_app_response");
  }

  async updateResponseData(
    responseId: string,
    payload: Record<string, any>,
  ): Promise<void> {
    await this.repo.updateAppData(responseId, payload);
  }
}

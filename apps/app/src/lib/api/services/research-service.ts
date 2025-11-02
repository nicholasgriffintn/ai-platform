import { fetchApi } from "../fetch-wrapper";
import type { ResearchStatus } from "~/types/research";

export class ResearchService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async fetchStatus(runId: string, provider?: string): Promise<ResearchStatus> {
    if (!runId) {
      throw new Error("Research run ID is required");
    }

    let headers: Record<string, string> = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error preparing headers for research status:", error);
    }

    const query = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    const response = await fetchApi(
      `/apps/retrieval/research/${encodeURIComponent(runId)}${query}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch research status: ${response.statusText}`,
      );
    }

    const payload = (await response.json()) as Record<string, any>;
    const result =
      payload?.response?.data ?? payload?.response ?? payload?.data ?? payload;

    if (!result?.run) {
      throw new Error("Invalid research status response");
    }

    return result as ResearchStatus;
  }
}

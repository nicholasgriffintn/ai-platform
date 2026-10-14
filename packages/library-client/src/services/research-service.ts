import type { ResearchStatus } from "@ngriffin_uk/polychat-schemas";

import { listJobsOfKind } from "../jobs.js";

export class ResearchService {
  async fetchStatus(runId: string): Promise<ResearchStatus> {
    if (!runId) {
      throw new Error("Research run ID is required");
    }

    const [job] = await listJobsOfKind("research", { external_id: runId });
    const status = job?.result;

    if (!status?.run || !status.provider) {
      throw new Error("Research run not found");
    }

    return { ...status, provider: status.provider, run: status.run };
  }
}

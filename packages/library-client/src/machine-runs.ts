import {
  machineRunClaimSchema,
  machineRunSnapshotSchema,
  machineRunUpdateSchema,
  type MachineRunUpdate,
} from "@ngriffin_uk/polychat-schemas";

import { returnFetchedData, type FetchApiOptions } from "./http.js";

export class MachineRunClient {
  constructor(private fetch: (path: string, options?: FetchApiOptions) => Promise<Response>) {}

  private async request(path: string, options: FetchApiOptions = {}) {
    const response = await this.fetch(path, options);

    if (!response.ok) {
      throw new Error(`Machine request failed (${response.status}).`);
    }

    return returnFetchedData<unknown>(response);
  }

  private deviceRuns(machineId: string, action: "claim" | "update"): string {
    return `/machines/${encodeURIComponent(machineId)}/runs/${action}`;
  }

  async claim(machineId: string, signal?: AbortSignal) {
    return machineRunClaimSchema.parse(
      await this.request(this.deviceRuns(machineId, "claim"), { method: "POST", signal }),
    );
  }

  async update(machineId: string, update: MachineRunUpdate, signal?: AbortSignal) {
    return machineRunSnapshotSchema.parse(
      await this.request(this.deviceRuns(machineId, "update"), {
        method: "POST",
        body: machineRunUpdateSchema.parse(update),
        signal,
      }),
    );
  }
}

export type { FetchApiOptions } from "./http.js";

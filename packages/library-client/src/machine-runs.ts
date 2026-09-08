import {
  machineRunClaimSchema,
  machineRunSnapshotSchema,
  machineRunRequestSchema,
  machineRunUpdateSchema,
  type MachineRunRequest,
  type MachineRunUpdate,
} from "@ngriffin_uk/polychat-schemas";

import { returnFetchedData, type FetchApiOptions } from "./http.js";

export class MachineRunClient {
  constructor(private fetch: (path: string, options?: FetchApiOptions) => Promise<Response>) {}

  private async request(machineId: string, path: string, options: FetchApiOptions = {}) {
    const response = await this.fetch(
      `/machines/${encodeURIComponent(machineId)}/runs${path}`,
      options,
    );

    if (!response.ok) {
      throw new Error(`Machine request failed (${response.status}).`);
    }

    return returnFetchedData<unknown>(response);
  }

  async start(machineId: string, request: MachineRunRequest, signal?: AbortSignal) {
    return machineRunSnapshotSchema.parse(
      await this.request(machineId, "", {
        method: "POST",
        body: machineRunRequestSchema.parse(request),
        signal,
      }),
    );
  }

  async read(machineId: string, id: string, signal?: AbortSignal) {
    return machineRunSnapshotSchema.parse(
      await this.request(machineId, `/${encodeURIComponent(id)}`, { signal }),
    );
  }

  async cancel(machineId: string, id: string) {
    return machineRunSnapshotSchema.parse(
      await this.request(machineId, `/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
    );
  }

  async claim(machineId: string, signal?: AbortSignal) {
    return machineRunClaimSchema.parse(
      await this.request(machineId, "/claim", { method: "POST", signal }),
    );
  }

  async update(machineId: string, update: MachineRunUpdate, signal?: AbortSignal) {
    return machineRunSnapshotSchema.parse(
      await this.request(machineId, "/update", {
        method: "POST",
        body: machineRunUpdateSchema.parse(update),
        signal,
      }),
    );
  }
}

export { delay } from "./utils/delay.js";
export type { FetchApiOptions } from "./http.js";

import {
  machineForgetResponseSchema,
  machineHeartbeatSchema,
  machineListResponseSchema,
  machineRecordSchema,
  type MachineHeartbeat,
  type MachineRecord,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper.js";
import { returnFetchedData } from "../http.js";

export class MachineService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async fetchMachines(): Promise<MachineRecord[]> {
    const response = await fetchApi("/machines", {
      method: "GET",
      headers: await this.getHeaders(),
      timeoutMs: 10000,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch machines: ${response.statusText}`);
    }

    return machineListResponseSchema.parse(await returnFetchedData<unknown>(response));
  }

  async heartbeat(input: MachineHeartbeat): Promise<MachineRecord | null> {
    const response = await fetchApi("/machines/heartbeat", {
      method: "POST",
      headers: await this.getHeaders(),
      body: machineHeartbeatSchema.parse(input),
      timeoutMs: 10000,
    });

    if (!response.ok) {
      throw new Error(`Failed to advertise machine: ${response.statusText}`);
    }

    return machineRecordSchema.nullable().parse(await returnFetchedData<unknown>(response));
  }

  async forget(machineId: string): Promise<void> {
    const response = await fetchApi(`/machines/${encodeURIComponent(machineId)}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
      timeoutMs: 10000,
    });

    if (!response.ok) {
      throw new Error(`Failed to forget machine: ${response.statusText}`);
    }

    machineForgetResponseSchema.parse(await returnFetchedData<unknown>(response));
  }
}

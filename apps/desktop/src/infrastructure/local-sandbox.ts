import { invoke } from "@tauri-apps/api/core";
import z from "zod/v4";

const localSandboxHttpResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  body: z.string(),
  contentType: z.string().nullable(),
});

export interface LocalSandboxBackend {
  localSandboxAvailable(): Promise<boolean>;
  startLocalSandbox(): Promise<string>;
  requestLocalSandbox(request: {
    id: string;
    path: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: string;
    contentType?: "application/json";
  }): Promise<z.infer<typeof localSandboxHttpResponseSchema>>;
  stopLocalSandbox(id: string): Promise<void>;
}

export const tauriLocalSandboxBackend: LocalSandboxBackend = {
  localSandboxAvailable: async () => z.boolean().parse(await invoke("local_sandbox_available")),
  startLocalSandbox: async () =>
    z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(await invoke("start_local_sandbox")),
  requestLocalSandbox: async (request) =>
    localSandboxHttpResponseSchema.parse(await invoke("request_local_sandbox", { request })),
  stopLocalSandbox: async (id) => {
    await invoke("stop_local_sandbox", { id });
  },
};

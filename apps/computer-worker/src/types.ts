import type { getSandbox } from "@cloudflare/sandbox";
import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";

export interface Env {
  Computer: DurableObjectNamespace<import("./index").Computer>;
  AgentHost: DurableObjectNamespace<import("./agent-host/agent-host-container").AgentHost>;
  POLYCHAT_API: Fetcher;
  BACKUP_BUCKET: R2Bucket;
  BACKUP_BUCKET_ENDPOINT?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_ACCOUNT_ID?: string;
  COMPUTER_SCREEN_HOST?: string;
  COMPUTER_SCREEN_SECRET?: string;
  SANDBOX_TRANSPORT?: "http" | "rpc";
}

export interface ComputerRequest {
  resourceId: string;
  handle?: string;
  fence?: number;
  checkpointReference?: string | null;
  input?: TeammateComputerInput;
  recordingId?: string;
}

export type ComputerSandbox = ReturnType<typeof getSandbox>;

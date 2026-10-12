import type { AgentHost } from "./agent-host/agent-host-container";

export interface Env {
  AgentHost: DurableObjectNamespace<AgentHost>;
  POLYCHAT_API: Fetcher;
  BACKUP_BUCKET: R2Bucket;
  BACKUP_BUCKET_ENDPOINT?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_ACCOUNT_ID?: string;
  SANDBOX_TRANSPORT?: "http" | "rpc";
  JWT_SECRET?: string;
}

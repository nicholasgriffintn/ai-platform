import type {
  SandboxRunEvent,
  SandboxTaskResult,
  SandboxWorkerExecuteRequest,
} from "@ngriffin_uk/polychat-schemas";

export type TaskParams = SandboxWorkerExecuteRequest;
export type TaskResult = SandboxTaskResult;
export type TaskEvent = SandboxRunEvent;
export type TaskEventEmitter = (event: TaskEvent) => Promise<void> | void;

export interface TaskSecrets {
  userToken: string;
}

export interface Env {
  APP_BASE_URL?: string;
  Sandbox: DurableObjectNamespace<
    import("./modules/sandbox/infrastructure/sandbox-container").Sandbox
  >;
  BACKUP_BUCKET: R2Bucket;
  BACKUP_BUCKET_ENDPOINT?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_ACCOUNT_ID?: string;
  SANDBOX_TRANSPORT?: "http" | "rpc";
  SANDBOX_INSTANCE_TYPE?: string;
  SANDBOX_PREVIEW_HOST?: string;
  ENV?: string;
  JWT_SECRET?: string;
  POLYCHAT_API: Fetcher;
}

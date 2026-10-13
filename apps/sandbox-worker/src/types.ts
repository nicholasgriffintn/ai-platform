import type {
  SandboxRunEvent,
  SandboxTaskResult,
  SandboxWorkerExecuteRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { Computer } from "./modules/computer/computer";
import type { Workspace } from "./modules/sandbox/infrastructure/workspace";

export type TaskParams = SandboxWorkerExecuteRequest;
export type TaskResult = SandboxTaskResult;
export type TaskEvent = SandboxRunEvent;
export type TaskEventEmitter = (event: TaskEvent) => Promise<void> | void;

export interface TaskSecrets {
  userToken: string;
}

export interface Env {
  APP_BASE_URL?: string;
  WORKSPACE: DurableObjectNamespace<Workspace>;
  COMPUTER: DurableObjectNamespace<Computer>;
  COMPUTER_SCREEN_HOST?: string;
  COMPUTER_SCREEN_SECRET?: string;
  BACKUP_BUCKET: R2Bucket;
  SANDBOX_PREVIEW_HOST?: string;
  ENV?: string;
  JWT_SECRET?: string;
  POLYCHAT_API: Fetcher;
}

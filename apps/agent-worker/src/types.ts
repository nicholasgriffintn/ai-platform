import type {
  ContainerCommandResult,
  ContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";

import type { HermesAgent } from "./harness/hermes";
import type { OpenCodeAgent } from "./harness/opencode";
import type { PiAgent } from "./harness/pi";

export interface WorkspaceRpc extends Rpc.DurableObjectBranded {
  setEgressPolicy(policy: ContainerEgressPolicy): Promise<void>;
  exec(
    command: string,
    options?: { cwd?: string; timeoutMs?: number },
  ): Promise<ContainerCommandResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

export interface Env {
  POLYCHAT_API: Fetcher;
  JWT_SECRET?: string;
  PI_AGENT: DurableObjectNamespace<PiAgent>;
  OPENCODE_AGENT: DurableObjectNamespace<OpenCodeAgent>;
  HERMES_AGENT: DurableObjectNamespace<HermesAgent>;
  WORKSPACE: DurableObjectNamespace<WorkspaceRpc>;
}

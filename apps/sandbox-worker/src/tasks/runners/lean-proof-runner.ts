import type { SandboxTaskRunner, SandboxTaskRunnerContext } from "../runner";
import { executeLeanProof } from "./lean-proof";

export class LeanProofTaskRunner implements SandboxTaskRunner {
  public readonly taskType = "lean-proof" as const;

  public execute(context: SandboxTaskRunnerContext) {
    return executeLeanProof(
      context.params,
      context.secrets,
      context.env,
      context.emitEvent,
      context.abortSignal,
    );
  }
}

import type { AgentHarnessTurnRequest } from "@ngriffin_uk/polychat-schemas";
import { ThinkHarness } from "agents/harness/think";
import { Lifecycle } from "agents/lifecycle";

import { toAiSdkTools } from "../tools/renderers";
import { WORKSPACE_TOOLS } from "../tools/workspace-tools";
import type { Env } from "../types";
import { HarnessHost, type HarnessOperationResult } from "./host";
import { polychatLanguageModel } from "./polychat-model";

const MAX_STEPS = 60;

export class ThinkAgent extends HarnessHost {
  private readonly harness = new ThinkHarness({
    model: () => polychatLanguageModel(this.binding().model, this.modelFetch),
    system: () => this.currentBinding()?.instructions,
    tools: () => toAiSdkTools(WORKSPACE_TOOLS, this.runTool),
    maxSteps: MAX_STEPS,
  });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    Lifecycle.install(this).use(this.harness);
  }

  protected async submitToHarness(request: AgentHarnessTurnRequest) {
    const receipt = await this.harness
      .session()
      .submit(
        { parts: [{ type: "text", text: request.input }] },
        { operationId: request.operationId },
      );

    return { operationId: receipt.operationId, accepted: receipt.accepted };
  }

  protected async waitForOperation(operationId: string): Promise<HarnessOperationResult> {
    const result = await this.harness.session().wait(operationId);

    return result.status === "done"
      ? { status: "done", ...(result.text ? { text: result.text } : {}) }
      : { status: "unanswered", ...(result.reason ? { reason: result.reason } : {}) };
  }

  protected async abortInHarness(operationId?: string): Promise<void> {
    await this.harness.session().abort(operationId);
  }

  protected async pendingOperationIds(): Promise<string[]> {
    return (await this.harness.pending()).map((operation) => operation.operationId);
  }
}

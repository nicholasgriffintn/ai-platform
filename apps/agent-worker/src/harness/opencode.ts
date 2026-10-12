import type { AgentHarnessTurnRequest } from "@ngriffin_uk/polychat-schemas";
import { OpenCodeWorkerd } from "@opencode/sdk/workerd";
import { OpenCodeHarness, ROOT_SESSION } from "agents/harness/opencode";
import { Lifecycle } from "agents/lifecycle";

import { toOpenCodePlugin } from "../tools/renderers";
import { WORKSPACE_TOOLS } from "../tools/workspace-tools";
import type { Env } from "../types";
import { HarnessHost, type HarnessOperationResult } from "./host";
import { MODEL_PORT_SESSION_HEADER, registerModelPort } from "./model-port-fetch";
import { POLYCHAT_PROVIDER_ID, polychatOpenCodePlugin } from "./polychat-model";

const OPENCODE_AGENT = "build";

export class OpenCodeAgent extends HarnessHost {
  private readonly session = this.ctx.id.toString();
  private readonly models = polychatOpenCodePlugin({
    agent: OPENCODE_AGENT,
    currentModel: () => this.currentBinding()?.model,
    currentInstructions: () => this.currentBinding()?.instructions,
    headers: { [MODEL_PORT_SESSION_HEADER]: this.session },
  });
  private readonly harness = new OpenCodeHarness({
    opencode: ({ storage }) =>
      OpenCodeWorkerd.create({
        storage,
        config: { default_agent: OPENCODE_AGENT },
        plugins: [this.models.plugin, toOpenCodePlugin(WORKSPACE_TOOLS, this.runTool)],
      }),
    defaults: { agent: OPENCODE_AGENT },
  });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    registerModelPort(this.session, this.modelFetch);
    Lifecycle.install(this).use(this.harness);
  }

  protected async submitToHarness(request: AgentHarnessTurnRequest) {
    const session = this.harness.session(ROOT_SESSION);

    await this.models.refresh();
    await session.setModel({ providerID: POLYCHAT_PROVIDER_ID, id: request.model });

    const receipt = await session.submit(request.input, {
      operationId: request.operationId,
      whenBusy: request.whenBusy,
    });

    return { operationId: receipt.operationId, accepted: receipt.accepted };
  }

  protected async waitForOperation(operationId: string): Promise<HarnessOperationResult> {
    const result = await this.harness.session(ROOT_SESSION).wait(operationId);

    return result.status === "done"
      ? { status: "done", ...(result.text ? { text: result.text } : {}) }
      : { status: "unanswered", ...(result.reason ? { reason: result.reason } : {}) };
  }

  protected async abortInHarness(operationId?: string): Promise<void> {
    await this.harness.session(ROOT_SESSION).abort(operationId);
  }

  protected async pendingOperationIds(): Promise<string[]> {
    return (await this.harness.pending({ session: ROOT_SESSION })).map(
      (operation) => operation.operationId,
    );
  }
}

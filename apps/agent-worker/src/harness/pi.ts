import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import type { AgentHarnessTurnRequest } from "@ngriffin_uk/polychat-schemas";
import { PiHarness, ROOT_SESSION } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";

import { toPiExtension } from "../tools/renderers";
import { WORKSPACE_TOOLS } from "../tools/workspace-tools";
import type { Env } from "../types";
import { HarnessHost, type HarnessOperationResult } from "./host";
import { POLYCHAT_PROVIDER_ID, polychatPiProvider } from "./polychat-model";

export class PiAgent extends HarnessHost {
  private readonly harness = new PiHarness({
    harness: ({ storage, context }) => {
      const models = createModels();
      const registry = createRegistry();

      models.setProvider(polychatPiProvider(() => this.currentBinding()?.model, this.modelFetch));
      registry.install(toPiExtension(WORKSPACE_TOOLS, this.runTool));
      registry.install({
        name: "polychat.instructions",
        tools: [],
        sections: [
          {
            key: "polychat",
            tag: false,
            render: () => this.currentBinding()?.instructions,
          },
        ],
      });

      return Harness.open(storage, { models, registry }, context);
    },
  });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    Lifecycle.install(this).use(this.harness);
  }

  protected async submitToHarness(request: AgentHarnessTurnRequest) {
    const session = this.harness.session(ROOT_SESSION);

    await session.setModel({ provider: POLYCHAT_PROVIDER_ID, id: request.model });

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

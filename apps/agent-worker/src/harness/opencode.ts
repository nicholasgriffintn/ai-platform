import type { AgentHarnessTurnRequest } from "@ngriffin_uk/polychat-schemas";
import { OpenCodeWorkerd } from "@opencode/sdk/workerd";
import { OpenCodeHarness, ROOT_SESSION } from "agents/harness/opencode";
import { Lifecycle } from "agents/lifecycle";

import { toOpenCodePlugin } from "../tools/renderers";
import { WORKSPACE_TOOLS } from "../tools/workspace-tools";
import type { Env } from "../types";
import { HarnessHost, type HarnessOperationResult } from "./host";
import { openCodeEventToHarnessEvent } from "./opencode-events";
import { POLYCHAT_PROVIDER_ID, polychatOpenCodePlugin } from "./polychat-model";

const OPENCODE_AGENT = "build";
const MODEL_HEADER_REFRESH_MS = 5 * 60_000;

export class OpenCodeAgent extends HarnessHost {
  private modelHeadersCache: Record<string, string> | undefined;
  private activeTurns = 0;
  private turnScope: AbortController | undefined;
  private readonly models = polychatOpenCodePlugin({
    agent: OPENCODE_AGENT,
    apiUrl: this.env.POLYCHAT_API_URL,
    currentModel: () => this.currentBinding()?.model,
    currentInstructions: () => this.currentBinding()?.instructions,
    currentHeaders: () => this.modelHeadersCache,
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
    Lifecycle.install(this).use(this.harness);
  }

  protected async submitToHarness(request: AgentHarnessTurnRequest) {
    const session = this.harness.session(ROOT_SESSION);

    await this.refreshModelHeaders();
    await session.setModel({ providerID: POLYCHAT_PROVIDER_ID, id: request.model });

    const receipt = await session.submit(request.input, {
      operationId: request.operationId,
      whenBusy: request.whenBusy,
    });

    return { operationId: receipt.operationId, accepted: receipt.accepted };
  }

  protected async waitForOperation(operationId: string): Promise<HarnessOperationResult> {
    this.beginTurn();

    try {
      const result = await this.harness.session(ROOT_SESSION).wait(operationId);

      return result.status === "done"
        ? { status: "done", ...(result.text ? { text: result.text } : {}) }
        : { status: "unanswered", ...(result.reason ? { reason: result.reason } : {}) };
    } finally {
      this.endTurn();
    }
  }

  protected async abortInHarness(operationId?: string): Promise<void> {
    await this.harness.session(ROOT_SESSION).abort(operationId);
  }

  protected async pendingOperationIds(): Promise<string[]> {
    return (await this.harness.pending({ session: ROOT_SESSION })).map(
      (operation) => operation.operationId,
    );
  }

  private async refreshModelHeaders(): Promise<void> {
    this.modelHeadersCache = await this.modelHeaders();
    await this.models.refresh();
  }

  private beginTurn(): void {
    this.activeTurns += 1;

    if (this.turnScope) {
      return;
    }

    const scope = new AbortController();
    const refresh = setInterval(() => {
      this.refreshModelHeaders().catch(() => undefined);
    }, MODEL_HEADER_REFRESH_MS);

    scope.signal.addEventListener("abort", () => clearInterval(refresh), { once: true });
    this.turnScope = scope;
    this.ctx.waitUntil(this.streamSessionEvents(scope.signal));
  }

  private endTurn(): void {
    this.activeTurns -= 1;

    if (this.activeTurns > 0) {
      return;
    }

    this.turnScope?.abort();
    this.turnScope = undefined;
  }

  private async streamSessionEvents(signal: AbortSignal): Promise<void> {
    try {
      for await (const event of this.harness.session(ROOT_SESSION).events(signal)) {
        const harnessEvent = openCodeEventToHarnessEvent(event);

        if (harnessEvent) {
          this.record(harnessEvent);
        }
      }
    } catch {
      return;
    }
  }
}

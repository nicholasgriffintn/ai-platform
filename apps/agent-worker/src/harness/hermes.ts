import type { AgentHarnessTurnRequest } from "@ngriffin_uk/polychat-schemas";
import {
  ContainerHarness,
  containerAgent,
  ROOT_SESSION,
  type ContainerEgressProps,
  type ContainerSessionEvent,
} from "agents/harness/container";
import { Lifecycle } from "agents/lifecycle";

import type { Env } from "../types";
import { HarnessHost, type HarnessOperationResult } from "./host";

export const HERMES_MODEL_HOST = "polychat.harness.internal";

export interface HermesModelRequest {
  path: string;
  method: string;
  headers: [string, string][];
  body: ArrayBuffer | null;
}
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const HERMES_EGRESS_ROUTES: ContainerEgressProps["routes"] = [
  { host: HERMES_MODEL_HOST, upstream: "https://polychat-api", headers: {}, strip: [] },
];

function requireContainer(ctx: DurableObjectState): Container {
  if (!ctx.container) {
    throw new Error("The Hermes container binding is not configured");
  }

  return ctx.container;
}

export class HermesAgent extends HarnessHost {
  private readonly harness: ContainerHarness;
  private readonly startedTools = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = requireContainer(ctx);
    const egress = (routes: ContainerEgressProps["routes"]) =>
      ctx.exports.HermesModelEgress({ props: { hostId: ctx.id.toString(), routes } });

    this.harness = new ContainerHarness({
      container,
      agent: containerAgent({
        image: container.images.hermes,
        adapter: "hermes",
        egress: HERMES_EGRESS_ROUTES,
      }),
      egress: (init) => egress(init.props.routes),
      enableInternet: false,
      idleTimeoutMs: IDLE_TIMEOUT_MS,
    });
    Lifecycle.install(this).use(this.harness);

    if (container.running) {
      void ctx.blockConcurrencyWhile(async () => {
        for (const route of HERMES_EGRESS_ROUTES) {
          await container.interceptOutboundHttp(route.host, egress(HERMES_EGRESS_ROUTES));
        }
      });
    }
  }

  async forwardModelRequest(request: HermesModelRequest): Promise<Response> {
    return this.modelFetch(`https://polychat-api/agents/model${request.path}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  }

  private recordToolActivity(events: readonly ContainerSessionEvent[]): void {
    for (const event of events) {
      if (event.type !== "message") {
        continue;
      }

      for (const part of event.message.parts) {
        if (part.type !== "tool") {
          continue;
        }

        if (!this.startedTools.has(part.toolCallId)) {
          this.startedTools.add(part.toolCallId);
          this.record({
            type: "tool-started",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
        }

        if (part.state !== "running") {
          this.record({
            type: "tool-finished",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            ...(part.state === "error"
              ? { error: JSON.stringify(part.output ?? "Tool failed") }
              : { output: JSON.stringify(part.output ?? "") }),
          });
        }
      }
    }
  }

  protected async submitToHarness(request: AgentHarnessTurnRequest) {
    const session = this.harness.session(ROOT_SESSION);

    await session.setModel(request.model);

    const stream = await session.events();

    stream.start((events) => this.recordToolActivity(events));
    this.ctx.waitUntil(
      session
        .wait(request.operationId)
        .catch(() => undefined)
        .then(() => stream.stop()),
    );

    const receipt = await session.submit(request.input, { operationId: request.operationId });

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

import { SANDBOX_PACKAGE_REGISTRY_HOSTS } from "@ngriffin_uk/polychat-library-sandbox";
import {
  agentHarnessAnswerRequestSchema,
  agentHarnessTurnRequestSchema,
  INTERNAL_SERVICE_AUTHORIZATION_HEADER,
  type AgentHarnessAnswerRequest,
  type AgentHarnessEvent,
  type AgentHarnessEventRecord,
  type AgentHarnessReceipt,
  type AgentHarnessTurnRequest,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, truncateText } from "@ngriffin_uk/polychat-utility-core";
import { createInternalServiceDelegationToken } from "@ngriffin_uk/polychat-utility-server/internal-service-auth";
import { DurableObject } from "cloudflare:workers";

import type { HarnessTool } from "../tools/workspace-tools";
import type { Env, WorkspaceRpc } from "../types";
import { toolNeedsApproval } from "./approval-policy";
import { HarnessEventLog } from "./event-log";
import { observeModelStream } from "./model-stream";

const BINDING_KEY = "binding";
const MAX_EVENT_OUTPUT_CHARS = 4_000;
const encoder = new TextEncoder();

export type HarnessBinding = Pick<
  AgentHarnessTurnRequest,
  "userId" | "conversationId" | "model" | "reasoningEffort" | "permissionMode" | "instructions"
>;

export interface HarnessOperationResult {
  status: "done" | "unanswered";
  text?: string;
  reason?: string;
}

interface PendingApproval {
  resolve(answer: { approved: boolean; reason?: string }): void;
}

export abstract class HarnessHost extends DurableObject<Env> {
  private readonly log = new HarnessEventLog(this.ctx.storage.sql);
  private readonly listeners = new Set<(record: AgentHarnessEventRecord) => void>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly watched = new Set<string>();
  private workspacePrepared = false;

  protected abstract submitToHarness(
    request: AgentHarnessTurnRequest,
  ): Promise<{ operationId: string; accepted: boolean }>;

  protected abstract waitForOperation(operationId: string): Promise<HarnessOperationResult>;

  protected abstract abortInHarness(operationId?: string): Promise<void>;

  protected abstract pendingOperationIds(): Promise<string[]>;

  protected currentBinding(): HarnessBinding | undefined {
    return this.ctx.storage.kv.get<HarnessBinding>(BINDING_KEY);
  }

  protected binding(): HarnessBinding {
    const binding = this.currentBinding();

    if (!binding) {
      throw new Error("This agent session has not been started");
    }

    return binding;
  }

  protected record(event: AgentHarnessEvent): void {
    const record = this.log.append(event);

    for (const listener of this.listeners) {
      listener(record);
    }
  }

  protected async modelHeaders(): Promise<Record<string, string>> {
    const binding = this.binding();
    const secret = this.env.JWT_SECRET?.trim();

    if (!secret) {
      throw new Error("The agent worker is missing JWT_SECRET");
    }

    return {
      [INTERNAL_SERVICE_AUTHORIZATION_HEADER]: `Bearer ${await createInternalServiceDelegationToken(secret, binding.userId)}`,
      "x-polychat-conversation-id": binding.conversationId,
    };
  }

  protected readonly modelFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);

    headers.delete("Authorization");

    for (const [name, value] of Object.entries(await this.modelHeaders())) {
      headers.set(name, value);
    }

    const response = await this.env.POLYCHAT_API.fetch(new Request(request, { headers }));

    if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
      return response;
    }

    const [forHarness, forEvents] = response.body.tee();
    const partId = generateId();

    this.ctx.waitUntil(
      observeModelStream(forEvents, partId, (event) => this.record(event)).catch(() => undefined),
    );

    return new Response(forHarness, response);
  };

  protected async workspace(): Promise<WorkspaceRpc> {
    const stub = this.env.WORKSPACE.getByName(`agent-${this.ctx.id.toString()}`);

    if (!this.workspacePrepared) {
      await stub.setEgressPolicy({
        mode: "list",
        hosts: [],
        readOnlyHosts: [...SANDBOX_PACKAGE_REGISTRY_HOSTS],
      });
      this.workspacePrepared = true;
    }

    return stub;
  }

  private requestApproval(toolName: string, description: string, input: unknown) {
    const approvalId = generateId();
    const answer = new Promise<{ approved: boolean; reason?: string }>((resolve) => {
      this.approvals.set(approvalId, { resolve });
    });

    this.record({
      type: "approval-requested",
      approvalId,
      toolName,
      description,
      input,
    });

    return answer.finally(() => this.approvals.delete(approvalId));
  }

  readonly runTool = async (tool: HarnessTool, rawInput: unknown): Promise<string> => {
    const call = tool.prepare(rawInput);
    const toolCallId = generateId();

    this.record({ type: "tool-started", toolCallId, toolName: tool.name, input: call.input });

    if (toolNeedsApproval(tool.effect, this.binding().permissionMode)) {
      const answer = await this.requestApproval(tool.name, call.description, call.input);

      if (!answer.approved) {
        const declined = `The user declined: ${call.description}${answer.reason ? `. ${answer.reason}` : ""}`;

        this.record({ type: "tool-finished", toolCallId, toolName: tool.name, error: declined });

        return declined;
      }
    }

    try {
      const output = await call.run(await this.workspace());

      this.record({
        type: "tool-finished",
        toolCallId,
        toolName: tool.name,
        output: truncateText(output, MAX_EVENT_OUTPUT_CHARS),
      });

      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.record({ type: "tool-finished", toolCallId, toolName: tool.name, error: message });

      return `Error: ${message}`;
    }
  };

  private watch(operationId: string): void {
    if (this.watched.has(operationId)) {
      return;
    }

    this.watched.add(operationId);
    this.ctx.waitUntil(
      this.waitForOperation(operationId)
        .then((result) => this.record({ type: "operation-settled", operationId, ...result }))
        .catch((error: unknown) =>
          this.record({
            type: "operation-settled",
            operationId,
            status: "unanswered",
            reason: error instanceof Error ? error.message : String(error),
          }),
        )
        .finally(() => this.watched.delete(operationId)),
    );
  }

  async submit(raw: AgentHarnessTurnRequest): Promise<AgentHarnessReceipt> {
    const request = agentHarnessTurnRequestSchema.parse(raw);
    const after = this.log.lastSeq();

    this.ctx.storage.kv.put<HarnessBinding>(BINDING_KEY, {
      userId: request.userId,
      conversationId: request.conversationId,
      model: request.model,
      permissionMode: request.permissionMode,
      ...(request.reasoningEffort ? { reasoningEffort: request.reasoningEffort } : {}),
      ...(request.instructions ? { instructions: request.instructions } : {}),
    });

    const receipt = await this.submitToHarness(request);

    this.watch(receipt.operationId);

    return { ...receipt, after };
  }

  async events(after: number): Promise<ReadableStream<Uint8Array>> {
    for (const operationId of await this.pendingOperationIds().catch(() => [])) {
      this.watch(operationId);
    }

    let listener: ((record: AgentHarnessEventRecord) => void) | undefined;

    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        let cursor = after;
        const send = (record: AgentHarnessEventRecord) => {
          if (record.seq > cursor) {
            cursor = record.seq;
            controller.enqueue(encoder.encode(`${JSON.stringify(record)}\n`));
          }
        };

        listener = send;
        this.listeners.add(send);

        for (const record of this.log.after(after)) {
          send(record);
        }
      },
      cancel: () => {
        if (listener) {
          this.listeners.delete(listener);
        }
      },
    });
  }

  async answer(raw: AgentHarnessAnswerRequest): Promise<{ applied: boolean }> {
    const request = agentHarnessAnswerRequestSchema.parse(raw);
    const pending = this.approvals.get(request.approvalId);

    if (!pending) {
      return { applied: false };
    }

    pending.resolve({
      approved: request.approved,
      ...(request.reason ? { reason: request.reason } : {}),
    });

    return { applied: true };
  }

  async abort(operationId?: string): Promise<void> {
    for (const pending of this.approvals.values()) {
      pending.resolve({ approved: false, reason: "The run was cancelled" });
    }

    await this.abortInHarness(operationId);
  }
}

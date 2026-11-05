import { extractChatCompletionText } from "@ngriffin_uk/polychat-ai-providers";
import { authorise, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  chatRunSchema,
  teammateRunConfigurationSchema,
  type ChatRun,
  type InboundChannelId,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MessageApprovalRow } from "~/infrastructure/database/schema";
import { normaliseMessagingAddress } from "~/infrastructure/providers/capabilities/messaging";
import { MessageApprovalRepository } from "~/modules/channels/infrastructure/MessageApprovalRepository";
import { resolveConnectorOperationApproval } from "~/modules/connectors/application/operation-approvals";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { prepareConversationCompletion } from "~/modules/responses/application/prepare";
import { toCommandMessages } from "~/modules/responses/application/runs/command-payload";
import type { ResponseCommand } from "~/modules/responses/domain/command";
import { findFunctionTool } from "~/modules/tools/application/catalogue";
import {
  resolveToolCallDestination,
  resolveToolCallEffectClass,
} from "~/modules/tools/application/effects";
import type { IUser } from "~/types";

import {
  describeMessageApproval,
  generateMessageApprovalCode,
  MESSAGE_APPROVAL_TTL_MS,
  type MessageApprovalReply,
} from "../domain/message-approval";

const CONNECTOR_TOOL_NAME = "use_recipe_connector";
const APPROVE_OPTION = "Approve";
const REJECT_OPTION = "Reject";
const NOT_VALID_REPLY = "That code is not valid any more. Open Polychat to answer.";
const NOT_CONTINUED_REPLY =
  "Your answer was recorded, but the work could not carry on. Open Polychat to see it.";

export interface MessageApprovalSender {
  channel: InboundChannelId;
  senderKey: string;
}

export interface IssuedMessageApproval {
  id: string;
  body: string;
}

interface PendingApprovalCall {
  interactionId: string;
  toolName: string;
  connectorApprovalId: string | null;
  argumentDigest: string;
  effectClass: string;
  expiresAt: number;
  subject: string;
  detail?: string;
}

export function bindingApprovalSenderKey(input: {
  bindingId: string;
  mappingId: string;
  revision: number;
}): Promise<string> {
  return sha256Hex(JSON.stringify(["binding", input.bindingId, input.mappingId, input.revision]));
}

export function providerApprovalSenderKey(input: {
  providerSettingsId: string;
  address: string;
}): Promise<string> {
  return sha256Hex(
    JSON.stringify([
      "provider",
      input.providerSettingsId,
      normaliseMessagingAddress(input.address),
    ]),
  );
}

function readStoredArguments(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? safeParseJson<unknown>(value) : value;

  return isRecord(parsed) ? parsed : {};
}

function readMessageData(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? safeParseJson<unknown>(value) : value;

  return isRecord(parsed) ? parsed : {};
}

function offersBothAnswers(data: Record<string, unknown>): boolean {
  const options = Array.isArray(data.options) ? data.options : [APPROVE_OPTION, REJECT_OPTION];

  return options.includes(APPROVE_OPTION) && options.includes(REJECT_OPTION);
}

async function readPendingApprovalCall(
  context: ServiceContext,
  run: ChatRun,
  userId: number,
  now: number,
): Promise<PendingApprovalCall | null> {
  if (run.status !== "awaiting_approval" || run.interactionKind !== "approval") {
    return null;
  }

  if (!run.lastMessageId) {
    return null;
  }

  const messages = context.repositories.get(MessageRepository);
  const [pendingCalls, stored] = await Promise.all([
    messages.listPendingToolCallsForRuns([run.id]),
    messages.getMessageById(run.lastMessageId),
  ]);
  const message = stored?.message;

  if (
    pendingCalls.length !== 1 ||
    stored?.conversation_id !== run.conversationId ||
    message?.role !== "tool" ||
    message.status !== "pending" ||
    typeof message.tool_call_id !== "string" ||
    typeof message.name !== "string"
  ) {
    return null;
  }

  const toolName = message.name;
  const tool = findFunctionTool(toolName);

  if (!tool) {
    return null;
  }

  const { effects } = tool;
  const interactionId = message.tool_call_id;
  const rawArguments = message.tool_call_arguments;
  const data = readMessageData(message.data);
  const effectClass = resolveToolCallEffectClass({ toolName, effects, rawArguments });

  if (toolName === CONNECTOR_TOOL_NAME && typeof data.approvalId === "string") {
    const approval = await context.repositories
      .get(ConnectorOperationApprovalRepository)
      .getByIdForUser(data.approvalId, userId);

    if (!approval || approval.state !== "pending" || approval.runId !== run.id) {
      return null;
    }

    return {
      interactionId,
      toolName,
      connectorApprovalId: approval.id,
      argumentDigest: approval.argumentDigest,
      effectClass,
      expiresAt: Math.min(Date.parse(approval.expiresAt), now + MESSAGE_APPROVAL_TTL_MS),
      subject: `${approval.provider} ${approval.operation}`,
      detail: canonicalJson(data.argumentSummary ?? {}),
    };
  }

  if (data.approvalRequired !== true && toolName !== "request_approval") {
    return null;
  }

  if (!offersBothAnswers(data)) {
    return null;
  }

  const callArguments = readStoredArguments(rawArguments);
  const destination = resolveToolCallDestination({ effects, rawArguments });

  return {
    interactionId,
    toolName,
    connectorApprovalId: null,
    argumentDigest: await sha256Hex(
      canonicalJson({ toolName, interactionId, arguments: callArguments }),
    ),
    effectClass,
    expiresAt: now + MESSAGE_APPROVAL_TTL_MS,
    subject:
      toolName === "request_approval" && typeof data.message === "string"
        ? data.message
        : destination
          ? `${toolName} on ${destination}`
          : toolName,
    detail:
      toolName === "request_approval"
        ? undefined
        : canonicalJson(redactSensitiveTokens(callArguments)),
  };
}

function isTeammateRun(run: ChatRun): boolean {
  return teammateRunConfigurationSchema.safeParse(run.resolvedConfiguration).success;
}

function isMessageApprovalPermitted(input: {
  userId: number;
  run: ChatRun;
  pending: PendingApprovalCall;
  sender: MessageApprovalSender;
  approval: {
    userId: number;
    channel: string;
    senderKey: string;
    interactionId: string;
    argumentDigest: string;
    runAttempt: number;
    state: string;
    expiresAt: number;
  };
  resolution: string;
  now: number;
}): boolean {
  const { approval, pending, run, sender } = input;

  return authorise("approval.message", {
    actorId: String(input.userId),
    ownerId: String(approval.userId),
    channel: sender.channel,
    approvalChannel: approval.channel,
    senderKey: sender.senderKey,
    approvalSenderKey: approval.senderKey,
    interactionId: pending.interactionId,
    pendingInteractionId: approval.interactionId,
    argumentDigest: pending.argumentDigest,
    approvalArgumentDigest: approval.argumentDigest,
    runAttempt: run.attempt,
    approvalRunAttempt: approval.runAttempt,
    runStatus: run.status,
    state: approval.state,
    expiresAt: approval.expiresAt,
    now: input.now,
    effectClass: pending.effectClass,
    resolution: input.resolution,
  }).allowed;
}

export async function issueMessageApproval(params: {
  context: ServiceContext;
  user: IUser;
  run: ChatRun;
  sender: MessageApprovalSender;
}): Promise<IssuedMessageApproval | null> {
  const { context, user, sender } = params;
  const run = await context.repositories.get(ConversationRunRepository).getById(params.run.id);

  if (!run || !ownsResource(user.id, run.initiatorUserId) || !isTeammateRun(run)) {
    return null;
  }

  const now = Date.now();
  const pending = await readPendingApprovalCall(context, run, user.id, now);

  if (
    !pending ||
    !isMessageApprovalPermitted({
      userId: user.id,
      run,
      pending,
      sender,
      approval: {
        userId: user.id,
        channel: sender.channel,
        senderKey: sender.senderKey,
        interactionId: pending.interactionId,
        argumentDigest: pending.argumentDigest,
        runAttempt: run.attempt,
        state: "pending",
        expiresAt: pending.expiresAt,
      },
      resolution: "approved",
      now,
    })
  ) {
    return null;
  }

  const code = generateMessageApprovalCode();
  const created = await context.repositories.get(MessageApprovalRepository).create({
    userId: user.id,
    runId: run.id,
    runAttempt: run.attempt,
    conversationId: run.conversationId,
    interactionId: pending.interactionId,
    toolName: pending.toolName,
    connectorApprovalId: pending.connectorApprovalId,
    argumentDigest: pending.argumentDigest,
    effectClass: pending.effectClass,
    channel: sender.channel,
    senderKey: sender.senderKey,
    codeHash: await sha256Hex(code),
    expiresAt: new Date(pending.expiresAt).toISOString(),
  });

  return created
    ? {
        id: created.id,
        body: describeMessageApproval({
          subject: pending.subject,
          detail: pending.detail,
          code,
        }),
      }
    : null;
}

async function resumeAnsweredRun(params: {
  context: ServiceContext;
  user: IUser;
  approval: MessageApprovalRow;
  resolution: MessageApprovalReply["resolution"];
}) {
  const { context, user, approval, resolution } = params;
  const commandId = `message_approval_${approval.id}`;

  if (approval.connector_approval_id) {
    await resolveConnectorOperationApproval({
      context,
      userId: user.id,
      approvalId: approval.connector_approval_id,
      resolution,
    });

    return prepareConversationCompletion({
      context,
      user,
      anonymousUser: undefined,
      request: {
        conversationId: approval.conversation_id,
        commandId,
        messages: [],
        stream: false,
        store: true,
        settings: { connector_approval_id: approval.connector_approval_id },
      },
      location: {},
    });
  }

  const manager = ConversationManager.getInstance({
    repositories: context.repositories,
    user,
    env: context.env,
    store: true,
    requestCache: context.requestCache,
  });
  const request: ResponseCommand = {
    conversationId: approval.conversation_id,
    commandId,
    messages: toCommandMessages(await manager.get(approval.conversation_id)),
    stream: false,
    store: true,
    settings: {
      options: {
        toolInteraction: {
          toolName: approval.tool_name,
          response: {
            interactionId: approval.interaction_id,
            resolution,
            option: resolution === "approved" ? APPROVE_OPTION : REJECT_OPTION,
            ...(approval.tool_name === "request_approval" ? {} : { approvalRequired: true }),
          },
        },
      },
    },
  };

  return prepareConversationCompletion({
    context,
    user,
    anonymousUser: undefined,
    request,
    location: {},
  });
}

export function readCompletionRun(
  completion: { run?: { run?: unknown } } | Response,
): ChatRun | null {
  if (completion instanceof Response) {
    return null;
  }

  const parsed = chatRunSchema.safeParse(completion.run?.run);

  return parsed.success ? parsed.data : null;
}

function isRoutineRun(run: ChatRun): boolean {
  const configuration = teammateRunConfigurationSchema.safeParse(run.resolvedConfiguration);

  return configuration.success && configuration.data.invocation?.source === "routine";
}

export type MessageApprovalAnswer =
  | { status: "invalid"; body: string }
  | { status: "resolved"; body: string; run: ChatRun | null };

export async function answerMessageApproval(params: {
  context: ServiceContext;
  user: IUser;
  sender: MessageApprovalSender;
  reply: MessageApprovalReply;
  messageId: string;
}): Promise<MessageApprovalAnswer> {
  const { context, user, sender, reply, messageId } = params;
  const invalid: MessageApprovalAnswer = { status: "invalid", body: NOT_VALID_REPLY };
  const approvals = context.repositories.get(MessageApprovalRepository);
  const approval = await approvals.getByCode(user.id, await sha256Hex(reply.code));

  if (!approval) {
    return invalid;
  }

  const retried =
    approval.resolved_message_id === messageId &&
    approval.state === reply.resolution &&
    approval.channel === sender.channel &&
    approval.sender_key === sender.senderKey;
  let claimed = retried ? approval : null;
  const run = await context.repositories.get(ConversationRunRepository).getById(approval.run_id);

  if (!claimed) {
    const now = Date.now();
    const pending = run ? await readPendingApprovalCall(context, run, user.id, now) : null;

    if (
      !run ||
      !pending ||
      !isMessageApprovalPermitted({
        userId: user.id,
        run,
        pending,
        sender,
        approval: {
          userId: approval.user_id,
          channel: approval.channel,
          senderKey: approval.sender_key,
          interactionId: approval.interaction_id,
          argumentDigest: approval.argument_digest,
          runAttempt: approval.run_attempt,
          state: approval.state,
          expiresAt: Date.parse(approval.expires_at),
        },
        resolution: reply.resolution,
        now,
      })
    ) {
      return invalid;
    }

    claimed = await approvals.claim({
      id: approval.id,
      userId: user.id,
      channel: sender.channel,
      senderKey: sender.senderKey,
      argumentDigest: pending.argumentDigest,
      resolution: reply.resolution,
      messageId,
      now: new Date(now).toISOString(),
    });

    if (!claimed) {
      return invalid;
    }
  }

  const acknowledged = reply.resolution === "approved" ? "Approved." : "Rejected.";

  try {
    const completion = await resumeAnsweredRun({
      context,
      user,
      approval: claimed,
      resolution: reply.resolution,
    });
    const text =
      completion instanceof Response || (run && isRoutineRun(run))
        ? ""
        : extractChatCompletionText(completion, { fallback: "" });

    return {
      status: "resolved",
      body: text ? `${acknowledged}\n\n${text}` : acknowledged,
      run: readCompletionRun(completion),
    };
  } catch (error) {
    context
      .getLogger({ prefix: "channels/message-approvals" })
      .warn("A message approval could not resume its run", { approvalId: claimed.id, error });

    return { status: "resolved", body: `${acknowledged} ${NOT_CONTINUED_REPLY}`, run: null };
  }
}

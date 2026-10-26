import { truncateText } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { CHANNEL_TOP_LEVEL_THREAD } from "~/modules/channels/application/ports/channel-adapter";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { postToTaskThread } from "./thread";
import { assignTask, personCaller, raiseCase, wakeTeammateOnTask } from "./work";

const CASE_TITLE_LIMIT = 120;

export async function receiveCaseFromChannel(
  context: ServiceContext,
  params: {
    projectId: string;
    bindingId: string;
    channel: string;
    teammateId: string | null;
    threadId: string | null;
    messageId: string;
    subject: string | null;
    body: string;
    senderAddress: string;
  },
) {
  const caller = personCaller(context);
  const existing = await context.repositories
    .get(ProjectTaskRepository)
    .findOpenChannelCase(params.bindingId, params.threadId ?? params.subject);

  if (existing) {
    await postToTaskThread(context, existing, {
      kind: "comment",
      author: caller.author,
      body: params.body,
    });
    await context.repositories.get(ProjectTaskRepository).touchTask(existing.id);

    if (existing.owner?.type === "teammate") {
      await wakeTeammateOnTask(
        context,
        existing,
        existing.owner.id,
        "mentioned",
        params.body.slice(0, 500),
      );
    }

    return existing;
  }

  const firstLine =
    params.body
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? "New request";
  const task = await raiseCase(
    context,
    params.projectId,
    {
      title: truncateText(params.subject?.trim() || firstLine, CASE_TITLE_LIMIT),
      description: params.body,
      priority: "none",
      raisedFromTaskId: null,
    },
    caller,
    {
      kind: params.channel === "email" ? "email" : "channel",
      address: params.senderAddress,
      requesterName: caller.author.name,
      channel: {
        bindingId: params.bindingId,
        threadId: params.threadId ?? params.subject,
        messageId: params.messageId,
        subject: params.subject,
      },
    },
  );

  return params.teammateId
    ? assignTask(
        context,
        params.projectId,
        task.id,
        { type: "teammate", id: params.teammateId },
        caller,
      )
    : task;
}

export async function sendCaseReply(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  body: string,
) {
  await requireProjectAccess(context, projectId);
  const task = await context.repositories
    .get(ProjectTaskRepository)
    .getTaskByReference(projectId, taskId);
  const caseDetail = task?.details.case;

  if (!task || task.kind !== "case" || !caseDetail?.channel) {
    throw new AssistantError(
      "This case has no channel to reply through",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const binding = await context.repositories
    .get(ChannelBindingRepository)
    .getById(caseDetail.channel.bindingId);
  const adapter = binding?.enabled ? getChannelAdapter(binding.channel) : null;

  if (!binding || binding.scope_type !== "project" || binding.scope_id !== projectId || !adapter) {
    throw new AssistantError(
      "The channel this case came from is no longer connected",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (!adapter.isReplyConfigured(context.env)) {
    throw new AssistantError(
      `${adapter.label} cannot send replies yet`,
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const channel = caseDetail.channel;
  const digest = await sha256Hex(`${task.id}:${body}`);

  await deliverOutboundOperation({
    context,
    deliveryId: `case_reply_${digest.slice(0, 40)}`,
    userId: context.requireUser().id,
    kind: "channel_reply",
    scopeId: binding.id,
    operationId: task.id,
    payload: { bindingId: binding.id, threadId: channel.threadId, body },
    send: () =>
      adapter.sendReply(
        {
          externalId: binding.external_id,
          body,
          threadId: channel.threadId ?? CHANNEL_TOP_LEVEL_THREAD,
          inReplyTo: channel.messageId,
          ...(channel.subject ? { subject: channel.subject } : {}),
        },
        context.env,
      ),
  });

  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: { ...task.details, case: { ...caseDetail, draftReply: null } },
  });
  const caller = personCaller(context);

  if (updated) {
    await postToTaskThread(context, updated, {
      kind: "event",
      author: caller.author,
      body: `${caller.author.name} sent a reply to ${caseDetail.requester.name}: ${truncateText(body, 280)}`,
    });
  }

  return updated ?? task;
}

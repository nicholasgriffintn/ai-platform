import { insert, SEED_MODEL, shift, sqlValue } from "./sql.mjs";

const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled", "interrupted"]);

function hostedProvenance(model) {
  return { site: "hosted", vendor: "workers-ai", model };
}

export function buildThread(options, messages) {
  const {
    id,
    userId,
    title,
    type = "chat",
    projectId = null,
    permissionMode = "auto_accept_edits",
    modelId = SEED_MODEL,
    modelTier = null,
    createdAt,
    minutesBetween = 2,
    pinned = false,
    unread = false,
    snoozedUntil = null,
    isArchived = false,
    isPublic = false,
    shareId = null,
    parentConversationId = null,
    parentMessageId = null,
    run = null,
  } = options;
  const messageStatements = [];
  const events = [];
  const messageIds = [];
  const runId = run ? `${id}-run` : null;
  let sequence = 0;
  let lastAt = createdAt;

  const event = (eventType, occurredAt, data) => {
    sequence += 1;
    events.push(
      insert("conversation_run_event", {
        id: `${runId}-e${sequence}`,
        run_id: runId,
        sequence,
        protocol_version: 1,
        attempt: run?.attempt ?? 1,
        type: eventType,
        occurred_at: occurredAt,
        data: data ?? {},
      }),
    );
  };

  if (run) {
    event("run.accepted", createdAt, { status: "accepted" });
  }

  messages.forEach((message, index) => {
    const messageId = `${id}-m${index + 1}`;
    const occurredAt = message.at ?? shift(createdAt, { minutes: (index + 1) * minutesBetween });
    const isAssistant = message.role === "assistant";
    const model = message.model === undefined ? (isAssistant ? modelId : null) : message.model;
    const provenance =
      message.provenance === undefined
        ? isAssistant && model
          ? hostedProvenance(model)
          : null
        : message.provenance;
    const status = message.status ?? (message.role === "tool" ? "success" : "complete");
    const attachedToRun = Boolean(runId) && message.run !== false;

    messageIds.push(messageId);
    lastAt = occurredAt;
    messageStatements.push(
      insert("message", {
        id: messageId,
        conversation_id: id,
        parent_message_id: message.parentMessageId ?? null,
        is_archived: message.isArchived ?? false,
        role: message.role,
        content:
          message.content === undefined
            ? ""
            : typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content),
        parts: message.parts ?? null,
        name: message.name ?? null,
        tool_calls: message.toolCalls ?? null,
        citations: message.citations ?? null,
        model,
        status,
        timestamp: Date.parse(occurredAt),
        platform: message.platform ?? "web",
        mode: message.mode ?? null,
        data: message.data ?? null,
        usage: message.usage ?? null,
        tool_call_id: message.toolCallId ?? null,
        tool_call_arguments: message.toolCallArguments ?? null,
        app: message.app ?? null,
        created_at: occurredAt,
        updated_at: occurredAt,
        run_id: attachedToRun ? runId : null,
        provenance_json: provenance,
      }),
    );

    if (attachedToRun) {
      event("message.created", occurredAt, { messageId, role: message.role, status });

      if (index === 0) {
        event("run.status_changed", shift(occurredAt, { seconds: 1 }), {
          previousStatus: "accepted",
          status: "running",
        });
      }
    }
  });

  const statements = [
    insert("conversation", {
      id,
      user_id: userId,
      type,
      title,
      is_archived: isArchived,
      is_public: isPublic,
      share_id: shareId,
      last_message_id: null,
      last_message_at: messageIds.length ? lastAt : null,
      message_count: messageIds.length,
      parent_conversation_id: parentConversationId,
      parent_message_id: parentMessageId,
      project_id: projectId,
      created_at: createdAt,
      updated_at: lastAt,
      model_id: modelId,
      model_tier: modelTier,
      permission_mode: permissionMode,
    }),
  ];

  if (run) {
    const runStatus = run.status ?? "succeeded";
    const terminal = TERMINAL_RUN_STATUSES.has(runStatus);
    const settledAt = shift(lastAt, { seconds: 30 });

    if (run.retryJson) {
      event("run.retry_changed", settledAt, run.retryJson);
    }

    if (runStatus !== "running" && runStatus !== "accepted") {
      event("run.status_changed", settledAt, {
        previousStatus: "running",
        status: runStatus,
        ...(terminal && run.terminalReason ? { terminalReason: run.terminalReason } : {}),
      });
    }

    statements.push(
      insert("conversation_run", {
        id: runId,
        conversation_id: id,
        project_id: run.projectId ?? projectId,
        project_task_id: run.projectTaskId ?? null,
        stage_id: run.stageId ?? null,
        initiator_user_id: run.initiatorUserId ?? userId,
        status: runStatus,
        attempt: run.attempt ?? 1,
        event_sequence: sequence,
        terminal_reason: run.terminalReason ?? null,
        last_message_id: null,
        context_json: run.contextJson ?? null,
        retry_json: run.retryJson ?? null,
        created_at: createdAt,
        updated_at: settledAt,
        started_at: shift(createdAt, { seconds: 1 }),
        completed_at: terminal ? settledAt : null,
        cancellation_requested_at: runStatus === "cancelled" ? shift(lastAt, { seconds: 5 }) : null,
        provenance_json: run.provenance ?? hostedProvenance(modelId),
        trigger: run.trigger ?? "user",
      }),
    );
  }

  statements.push(...messageStatements, ...events);

  if (messageIds.length) {
    const lastMessageId = sqlValue(messageIds.at(-1));

    statements.push(
      `UPDATE "conversation" SET "last_message_id" = ${lastMessageId} WHERE "id" = ${sqlValue(id)};`,
    );

    if (runId) {
      statements.push(
        `UPDATE "conversation_run" SET "last_message_id" = ${lastMessageId} WHERE "id" = ${sqlValue(runId)};`,
      );
    }
  }

  if (pinned || unread || snoozedUntil) {
    statements.push(
      insert("conversation_user_state", {
        conversation_id: id,
        user_id: userId,
        is_pinned: pinned,
        is_unread: unread,
        snoozed_until: snoozedUntil,
        revision: 1,
        updated_at: lastAt,
      }),
    );
  }

  return { statements, conversationId: id, messageIds, runId, lastAt };
}

export function toolCall({ name, callId, input, result, data, status = "success", resultStatus }) {
  return [
    {
      role: "assistant",
      content: "",
      parts: [{ type: "tool_use", name, toolCallId: callId, input }],
      status: "complete",
    },
    {
      role: "tool",
      name,
      toolCallId: callId,
      toolCallArguments: input,
      content: typeof result === "string" ? result : JSON.stringify(result),
      status: resultStatus ?? status,
      data,
      model: null,
      provenance: null,
    },
  ];
}

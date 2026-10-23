import { assistantOutputs } from "@ngriffin_uk/polychat-library-chat/response-output";
import {
  isTerminalResponseStatus,
  isWaitingResponseStatus,
  responseStreamEventSchema,
  type A2aArtifact,
  type A2aMessage,
  type A2aTask,
  type A2aTaskArtifactUpdateEvent,
  type A2aTaskState,
  type A2aTaskStatus,
  type A2aTaskStatusUpdateEvent,
  type PlatformResponse,
  type ResponseStatus,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

const TASK_STATES: Record<ResponseStatus, A2aTaskState> = {
  queued: "submitted",
  in_progress: "working",
  awaiting_input: "input-required",
  awaiting_approval: "input-required",
  awaiting_takeover: "input-required",
  cancelling: "working",
  completed: "completed",
  failed: "failed",
  cancelled: "canceled",
  incomplete: "failed",
};

const WAITING_MESSAGE =
  "Waiting on its owner in Polychat. Approvals and questions are answered there, then the task carries on.";

export function a2aTaskState(status: ResponseStatus): A2aTaskState {
  return TASK_STATES[status];
}

function agentMessage(text: string, response: PlatformResponse): A2aMessage {
  return {
    kind: "message",
    messageId: generateId(),
    role: "agent",
    parts: [{ kind: "text", text }],
    contextId: response.conversation_id,
    taskId: response.id,
  };
}

export function toA2aTaskStatus(response: PlatformResponse): A2aTaskStatus {
  return {
    state: a2aTaskState(response.status),
    timestamp: response.updated_at,
    ...(isWaitingResponseStatus(response.status)
      ? { message: agentMessage(WAITING_MESSAGE, response) }
      : {}),
  };
}

export function toA2aArtifacts(response: PlatformResponse): A2aArtifact[] {
  return assistantOutputs(response).map((output) => ({
    artifactId: output.id,
    parts: [{ kind: "text", text: output.text }],
  }));
}

export function toA2aTask(response: PlatformResponse): A2aTask {
  const artifacts = toA2aArtifacts(response);

  return {
    kind: "task",
    id: response.id,
    contextId: response.conversation_id,
    status: toA2aTaskStatus(response),
    ...(artifacts.length > 0 ? { artifacts } : {}),
  };
}

export type A2aStreamResult = A2aTask | A2aTaskStatusUpdateEvent | A2aTaskArtifactUpdateEvent;

export interface A2aStreamProjection {
  project(event: unknown): A2aStreamResult[];
  readonly finished: boolean;
}

export function createA2aStreamProjection(): A2aStreamProjection {
  const startedArtifacts = new Set<string>();
  let task: { id: string; contextId: string } | null = null;
  let finished = false;

  const statusUpdate = (response: PlatformResponse): A2aTaskStatusUpdateEvent => {
    const final =
      isTerminalResponseStatus(response.status) || isWaitingResponseStatus(response.status);

    finished ||= final;

    return {
      kind: "status-update",
      taskId: response.id,
      contextId: response.conversation_id,
      status: toA2aTaskStatus(response),
      final,
    };
  };

  return {
    get finished() {
      return finished;
    },
    project(raw) {
      const parsed = responseStreamEventSchema.safeParse(raw);

      if (!parsed.success || finished) {
        return [];
      }

      const event = parsed.data;

      if (event.type === "response.created") {
        task = { id: event.response.id, contextId: event.response.conversation_id };

        return [toA2aTask(event.response)];
      }

      if (event.type === "response.output_text.delta" && task) {
        const append = startedArtifacts.has(event.item_id);

        startedArtifacts.add(event.item_id);

        return [
          {
            kind: "artifact-update",
            taskId: task.id,
            contextId: task.contextId,
            artifact: { artifactId: event.item_id, parts: [{ kind: "text", text: event.delta }] },
            append,
            lastChunk: false,
          },
        ];
      }

      if (
        event.type === "response.in_progress" ||
        event.type === "response.status_changed" ||
        event.type === "response.waiting" ||
        event.type === "response.completed" ||
        event.type === "response.failed" ||
        event.type === "response.cancelled" ||
        event.type === "response.incomplete"
      ) {
        return [statusUpdate(event.response)];
      }

      return [];
    },
  };
}

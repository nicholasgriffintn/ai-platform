import {
  answerUserQuestionsSchema,
  userQuestionSetSchema,
  type AnswerUserQuestionsInput,
  type ProjectTask,
  type UserQuestionSet,
} from "@ngriffin_uk/polychat-schemas";

import { buildMessageParts } from "~/lib/chat/messages/parts";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { withThreadLock } from "~/services/conversations/coordinator/client";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { readInteractionMessageData } from "./interaction-messages";
import { isProjectTaskInteractionExpired } from "./interaction-recovery";

interface PendingQuestionMessage {
  messageId: string;
  data: Record<string, unknown>;
  questions: UserQuestionSet;
  toolCallId?: string;
  timestamp?: number;
}

async function getPendingQuestionMessage(
  context: ServiceContext,
  conversationId: string,
): Promise<PendingQuestionMessage | null> {
  const message = await context.repositories.messages.getLatestPendingToolMessage(conversationId, [
    "ask_user",
  ]);
  const data = readInteractionMessageData(message?.data);
  const parsed = userQuestionSetSchema.safeParse(data);

  if (
    !message ||
    !data ||
    !parsed.success ||
    typeof message.id !== "string" ||
    isProjectTaskInteractionExpired(message)
  ) {
    return null;
  }

  return {
    messageId: message.id,
    data,
    questions: parsed.data,
    ...(typeof message.tool_call_id === "string" ? { toolCallId: message.tool_call_id } : {}),
    ...(typeof message.timestamp === "number" ? { timestamp: message.timestamp } : {}),
  };
}

export async function getPendingProjectTaskQuestions(
  context: ServiceContext,
  task: Pick<ProjectTask, "conversationId">,
): Promise<UserQuestionSet | null> {
  if (!task.conversationId) {
    return null;
  }

  const pending = await getPendingQuestionMessage(context, task.conversationId);

  return pending?.questions ?? null;
}

function formatAnswers(questions: UserQuestionSet, input: AnswerUserQuestionsInput): string {
  const prompts = new Map(questions.questions.map((question) => [question.id, question.prompt]));

  return [
    "Answers to the agent's questions:",
    ...input.answers.map(
      ({ questionId, answer }) => `- ${prompts.get(questionId) ?? questionId}: ${answer}`,
    ),
  ].join("\n");
}

export async function answerProjectTaskQuestions(params: {
  context: ServiceContext;
  task: ProjectTask;
  input: AnswerUserQuestionsInput;
}): Promise<void> {
  const { context, task } = params;
  const input = answerUserQuestionsSchema.parse(params.input);

  if (task.status !== "blocked" || task.blockedReason !== "awaiting_input") {
    throw new AssistantError("This task is not waiting for answers", ErrorType.CONFLICT_ERROR, 409);
  }

  if (!task.conversationId) {
    throw new AssistantError(
      "This task has no conversation to resume",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const conversationId = task.conversationId;

  const pending = await getPendingQuestionMessage(context, conversationId);

  if (!pending || pending.questions.interactionId !== input.interactionId) {
    throw new AssistantError(
      "These questions are no longer waiting for an answer. Refresh the conversation.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const expectedIds = new Set(pending.questions.questions.map((question) => question.id));
  const answerIds = new Set(input.answers.map((answer) => answer.questionId));

  if (
    answerIds.size !== input.answers.length ||
    answerIds.size !== expectedIds.size ||
    [...answerIds].some((id) => !expectedIds.has(id))
  ) {
    throw new AssistantError(
      "Answer each pending question once before continuing",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const user = context.requireUser();
  const content = formatAnswers(pending.questions, input);

  await withThreadLock(
    { env: context.env, conversationId, kind: "human_response" },
    async (lease) => {
      const currentPending = await getPendingQuestionMessage(context, conversationId);

      if (!currentPending || currentPending.questions.interactionId !== input.interactionId) {
        throw new AssistantError(
          "These questions are no longer waiting for an answer. Refresh the conversation.",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      const resolvedData = {
        ...currentPending.data,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        answers: input.answers,
        humanInTheLoop: {
          type: "question",
          status: "resolved",
          interactionId: input.interactionId,
          questions: currentPending.questions.questions,
          answers: input.answers,
          requires_user_action: false,
        },
      };
      const resolvedMessage: Message = {
        role: "tool",
        name: "ask_user",
        content: "Questions answered.",
        status: "resolved",
        data: resolvedData,
        tool_call_id: currentPending.toolCallId,
        timestamp: currentPending.timestamp,
      };

      await lease.assertOwned();
      await context.repositories.messages.updateMessage(conversationId, currentPending.messageId, {
        content: resolvedMessage.content,
        status: resolvedMessage.status,
        data: resolvedData,
        parts: buildMessageParts(resolvedMessage),
      });

      const conversationManager = ConversationManager.getInstance({
        database: context.database,
        repositories: context.repositories,
        user,
        env: context.env,
        store: true,
        runId: task.runId ?? undefined,
        writeFence: lease,
      });

      await conversationManager.add(conversationId, {
        id: generateId(),
        role: "user",
        content,
        data: {
          userQuestionResponse: {
            interactionId: input.interactionId,
            answers: input.answers,
          },
        },
        timestamp: Date.now(),
        platform: "web",
      });
    },
  );
}

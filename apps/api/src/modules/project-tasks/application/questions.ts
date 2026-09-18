import { mergeHumanInTheLoop } from "@ngriffin_uk/polychat-library-interactions";
import {
  answerUserQuestionsSchema,
  userQuestionSetSchema,
  type AnswerUserQuestionsInput,
  type ProjectTask,
  type UserQuestionSet,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  readPendingInteractionMessage,
  resolvePendingInteraction,
  type PendingInteractionMessage,
} from "./interaction-resolution";

function getPendingQuestionMessage(
  context: ServiceContext,
  conversationId: string,
): Promise<PendingInteractionMessage<UserQuestionSet> | null> {
  return readPendingInteractionMessage({
    context,
    conversationId,
    toolNames: ["ask_user"],
    parse: (data) => {
      const parsed = userQuestionSetSchema.safeParse(data);

      return parsed.success ? parsed.data : null;
    },
  });
}

export async function getPendingProjectTaskQuestions(
  context: ServiceContext,
  task: Pick<ProjectTask, "conversationId">,
): Promise<UserQuestionSet | null> {
  if (!task.conversationId) {
    return null;
  }

  const pending = await getPendingQuestionMessage(context, task.conversationId);

  return pending?.interaction ?? null;
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
}): Promise<{ toolCallId: string }> {
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

  if (!pending || pending.interaction.interactionId !== input.interactionId) {
    throw new AssistantError(
      "These questions are no longer waiting for an answer. Refresh the conversation.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const expectedIds = new Set(pending.interaction.questions.map((question) => question.id));
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

  const content = formatAnswers(pending.interaction, input);

  const resolved = await resolvePendingInteraction<UserQuestionSet>({
    context,
    task,
    conversationId,
    expectedInteractionId: input.interactionId,
    interactionIdOf: (questions) => questions.interactionId,
    conflictMessage:
      "These questions are no longer waiting for an answer. Refresh the conversation.",
    readPending: (id) => getPendingQuestionMessage(context, id),
    buildResolution: (current) => ({
      data: {
        ...current.data,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        answers: input.answers,
        humanInTheLoop: mergeHumanInTheLoop(current.data.humanInTheLoop, {
          status: "resolved",
          interactionId: input.interactionId,
          questions: current.interaction.questions,
          answers: input.answers,
          requires_user_action: false,
        }),
      },
      toolName: "ask_user",
      toolContent: "Questions answered.",
      userContent: content,
      userData: {
        userQuestionResponse: {
          interactionId: input.interactionId,
          answers: input.answers,
        },
      },
    }),
  });

  return { toolCallId: resolved.toolCallId };
}

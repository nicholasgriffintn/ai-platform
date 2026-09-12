import {
  userQuestionsSchema,
  type ChatCompletionResponseBody,
  type DelegationResult,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { filterAccessibleOutputs } from "~/services/outputs/access";
import { extractTextFromMessageContent } from "~/utils/messages";

type ResponseMessage = ChatCompletionResponseBody["choices"][number]["message"];
type DelegationResultMessage = {
  content?: unknown;
  data?: unknown;
  id?: string;
  status?: string | null;
  citations?: Array<string | null>;
};

export async function listDelegationResultOutputIds(
  context: ServiceContext,
  runId: string | undefined,
): Promise<string[]> {
  const outputs = runId ? await context.repositories.outputs.listOutputsForRun(runId) : [];
  const accessibleOutputs = context.user
    ? await filterAccessibleOutputs(context, context.user.id, outputs)
    : [];

  return accessibleOutputs.map((output) => output.id);
}

function finalAssistantMessage(response: ChatCompletionResponseBody): ResponseMessage | undefined {
  const finalMessageId = response.run?.run.lastMessageId;
  const assistantMessages = response.choices
    .map((choice) => choice.message)
    .filter((message) => message.role === "assistant");

  return (
    assistantMessages.find((message) => message.id === finalMessageId) ?? assistantMessages.at(-1)
  );
}

export async function buildDelegationResult(
  context: ServiceContext,
  response: ChatCompletionResponseBody,
): Promise<{ result: DelegationResult; failed: boolean }> {
  const message = finalAssistantMessage(response);

  return buildDelegationResultFromMessage(
    context,
    message,
    response.run?.run.id,
    response.run?.run.lastMessageId,
  );
}

export async function buildDelegationResultFromMessage(
  context: ServiceContext,
  message: DelegationResultMessage | undefined,
  runId: string | undefined,
  lastMessageId?: string | null,
): Promise<{ result: DelegationResult; failed: boolean }> {
  const summary = message ? extractTextFromMessageContent(message.content).trim() : "";

  if (!message || !summary) {
    throw new Error("The delegate returned no final result for its parent.");
  }

  const outputIds = await listDelegationResultOutputIds(context, runId);

  return {
    result: {
      summary: summary.slice(0, 2000),
      outputIds,
      finalMessageId: message.id ?? lastMessageId ?? null,
      citations: (message.citations ?? []).filter((citation): citation is string =>
        Boolean(citation),
      ),
      outstandingQuestions: [],
    },
    failed: message.status === "failed" || message.status === "error",
  };
}

export function buildDelegationPendingResult(message: DelegationResultMessage): DelegationResult {
  const questions = userQuestionsSchema.safeParse(
    typeof message.data === "object" && message.data !== null && "questions" in message.data
      ? message.data.questions
      : undefined,
  );

  return {
    summary: extractTextFromMessageContent(message.content).trim().slice(0, 2000),
    outputIds: [],
    finalMessageId: message.id ?? null,
    citations: [],
    outstandingQuestions: questions.success ? questions.data : [],
  };
}

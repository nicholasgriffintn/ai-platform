import { pendingTakeover } from "@ngriffin_uk/polychat-library-interactions";
import type { ComputerTaskInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  destroyBrowserSession,
  inspectBrowserSession,
  startBrowserSession,
  stopBrowserSession,
} from "~/modules/computer-use/application/sessions";
import type { IFunctionResponse } from "~/types";
import type { ApiToolExecutionContext } from "~/types/functions";

export async function executeComputerTask(
  input: ComputerTaskInput,
  toolContext: ApiToolExecutionContext,
): Promise<IFunctionResponse> {
  const context = toolContext.request.context;

  if (!context) {
    throw new AssistantError(
      "Browser use requires a signed-in conversation",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const conversationId = toolContext.request.request?.completion_id;

  if (input.operation === "start") {
    if (!conversationId || !toolContext.toolCallId) {
      throw new AssistantError(
        "Browser use requires a stored conversation",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const sessionId = await startBrowserSession(
      context,
      input,
      conversationId,
      toolContext.toolCallId,
    );

    return {
      status: "pending",
      name: "use_computer",
      content:
        "The browser task has started. Handle website approvals and sign-in in the browser card, then continue when the task finishes.",
      data: {
        renderer: "browser_session",
        sessionId,
        humanInTheLoop: pendingTakeover({
          interactionId: toolContext.toolCallId,
          toolName: "use_computer",
        }),
      },
    };
  }

  if (input.operation === "inspect") {
    const session = await inspectBrowserSession(context, input.sessionId);

    return {
      status: session.status === "failed" ? "error" : "success",
      name: "use_computer",
      content: session.outputText || session.error || `Browser task is ${session.status}.`,
      data: { renderer: "browser_session", sessionId: session.id },
    };
  }

  const result =
    input.operation === "stop"
      ? await stopBrowserSession(context, input.sessionId)
      : await destroyBrowserSession(context, input.sessionId);

  return {
    status: "success",
    name: "use_computer",
    content: input.operation === "stop" ? "Browser cancellation requested." : "Browser closed.",
    data: result,
  };
}

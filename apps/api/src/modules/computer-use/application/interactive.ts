import { pendingTakeover } from "@ngriffin_uk/polychat-library-interactions";
import type { ComputerControlInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { judgeComputerObservation } from "~/modules/teammates/application/computer-observation-judgement";
import {
  operateTeammateComputerAsAgent,
  releaseTeammateComputerAgentLease,
} from "~/modules/teammates/application/computers";
import { requireTeammateContext } from "~/modules/teammates/application/contexts";
import {
  computerInputRequiresTakeover,
  describeComputerTakeoverInput,
} from "~/modules/teammates/domain/computer-policy";
import { requireProjectCapabilityAccess } from "~/modules/workspaces/application/access";
import type { IFunctionResponse } from "~/types";
import type { ApiToolExecutionContext } from "~/types/functions";

export async function executeComputerControl(
  args: ComputerControlInput,
  toolContext: ApiToolExecutionContext,
): Promise<IFunctionResponse> {
  const context = toolContext.request.context;
  const contextId = toolContext.request.request?.teammate_context_id;
  const runId = context?.executionRunId;
  const runAttempt = context?.executionRunAttempt;

  if (!context || !contextId || !runId || !runAttempt) {
    return {
      status: "error",
      name: "use_computer",
      content: "A hosted computer is only available inside a durable teammate context.",
    };
  }

  if (context.requireUser().plan_id !== "pro") {
    throw new AssistantError(
      "The built-in computer requires a premium subscription",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const requiresTakeover =
    args.operation === "request_takeover" ||
    (args.operation === "input" && computerInputRequiresTakeover(args.input));

  const teammateContext = await requireTeammateContext(context, contextId);

  if (teammateContext.scope.type === "project") {
    await requireProjectCapabilityAccess(context, teammateContext.scope.id, "tool", "use_computer");
  }

  if (requiresTakeover) {
    await releaseTeammateComputerAgentLease({ context, contextId, runId, runAttempt });
    const reason =
      args.operation === "request_takeover"
        ? args.reason
        : args.operation === "input"
          ? `${describeComputerTakeoverInput(args.input)} may change an external system, so it needs supervised control.`
          : "Supervised computer control is required.";

    return {
      status: "pending",
      name: "use_computer",
      content: reason,
      data: {
        renderer: "computer_takeover",
        contextId,
        reason,
        humanInTheLoop: pendingTakeover({
          interactionId: toolContext.toolCallId,
          toolName: "use_computer",
        }),
      },
    };
  }

  const result = await operateTeammateComputerAsAgent({
    context,
    contextId,
    runId,
    runAttempt,
    ...(args.operation === "input"
      ? { input: args.input }
      : args.operation === "wait"
        ? { input: { type: "wait" as const, durationMs: args.durationMs } }
        : args.operation === "read"
          ? { input: { type: "read" as const } }
          : args.operation === "check"
            ? { input: { type: "read" as const } }
            : {}),
  });
  const screenshot = result.observation.screenshot;
  const text =
    typeof result.observation.text === "string" && result.observation.text
      ? result.observation.text
      : null;
  const title =
    typeof result.observation.title === "string" ? result.observation.title : "Hosted computer";
  const width = typeof result.observation.width === "number" ? result.observation.width : 1440;
  const height = typeof result.observation.height === "number" ? result.observation.height : 900;
  const judgement =
    args.operation === "check"
      ? await judgeComputerObservation({
          env: toolContext.request.env,
          user: toolContext.request.user,
          completionId: toolContext.completionId,
          conversationId: toolContext.request.request?.completion_id,
          condition: args.condition,
          observation: result.observation,
        })
      : undefined;

  return {
    status: "success",
    name: "use_computer",
    content: [
      { type: "text", text: `Active window: ${title}. Viewport: ${width} × ${height}.` },
      ...(text ? [{ type: "text" as const, text }] : []),
      ...(judgement && args.operation === "check"
        ? [
            {
              type: "text" as const,
              text: judgement.conditionMet
                ? `Checked condition: met — ${args.condition}`
                : `Checked condition: not confidently met — ${args.condition}`,
            },
          ]
        : []),
      ...(typeof screenshot === "string"
        ? [
            {
              type: "image_url" as const,
              image_url: { url: screenshot, detail: "high" as const },
            },
          ]
        : []),
    ],
    data: {
      renderer: "computer_observation",
      computerId: result.computer.id,
      observation: { title, width, height },
      screenshot: typeof screenshot === "string" ? screenshot : null,
      text,
      title,
      width,
      height,
      contextId,
      ...(judgement && args.operation === "check"
        ? {
            condition: {
              text: args.condition,
              met: judgement.conditionMet,
              receipt: judgement.receipt,
            },
          }
        : {}),
    },
  };
}

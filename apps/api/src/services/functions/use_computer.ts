import { pendingTakeover } from "@ngriffin_uk/polychat-library-interactions";

import {
  computerInputRequiresTakeover,
  describeComputerTakeoverInput,
} from "~/services/teammates/computer-policy";
import {
  operateTeammateComputerAsAgent,
  releaseTeammateComputerAgentLease,
} from "~/services/teammates/computers";
import type { ApiToolDefinition } from "~/types/functions";

import { use_computer as descriptor } from "./definitions/use_computer";

export const use_computer: ApiToolDefinition = {
  ...descriptor,
  execute: async (args, toolContext) => {
    const context = toolContext.request.context;
    const contextId = toolContext.request.request?.teammate_context_id;
    const runId = context?.executionRunId;
    const runAttempt = context?.executionRunAttempt;

    if (!context || !contextId || !runId || !runAttempt) {
      return {
        status: "error",
        name: descriptor.name,
        content: "A hosted computer is only available inside a durable teammate context.",
      };
    }

    const requiresTakeover =
      args.operation === "request_takeover" ||
      (args.operation === "input" && computerInputRequiresTakeover(args.input));

    if (requiresTakeover) {
      await releaseTeammateComputerAgentLease({ context, contextId, runId });
      const reason =
        args.operation === "request_takeover"
          ? args.reason
          : `${describeComputerTakeoverInput(args.input)} may change an external system, so it needs supervised control.`;

      return {
        status: "pending",
        name: descriptor.name,
        content: reason,
        data: {
          renderer: "computer_takeover",
          contextId,
          reason,
          humanInTheLoop: pendingTakeover({
            interactionId: toolContext.toolCallId,
            toolName: descriptor.name,
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

    return {
      status: "success",
      name: descriptor.name,
      content: [
        { type: "text", text: `Active window: ${title}. Viewport: ${width} × ${height}.` },
        ...(text ? [{ type: "text" as const, text }] : []),
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
      },
    };
  },
};

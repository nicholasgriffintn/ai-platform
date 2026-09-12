import { computerInputRequiresTakeover } from "~/services/teammates/computer-policy";
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
          : "This computer action may change an external system and needs supervised control.";

      return {
        status: "pending",
        name: descriptor.name,
        content: reason,
        data: {
          renderer: "computer_takeover",
          contextId,
          reason,
          humanInTheLoop: {
            type: "takeover",
            status: "pending",
            interactionId: toolContext.toolCallId,
            toolName: descriptor.name,
            requires_user_action: true,
          },
        },
      };
    }

    const result = await operateTeammateComputerAsAgent({
      context,
      contextId,
      runId,
      runAttempt,
      ...(args.operation === "input" ? { input: args.input } : {}),
    });
    const screenshot = result.observation.screenshot;
    const title =
      typeof result.observation.title === "string" ? result.observation.title : "Hosted computer";
    const width = typeof result.observation.width === "number" ? result.observation.width : 1440;
    const height = typeof result.observation.height === "number" ? result.observation.height : 900;

    return {
      status: "success",
      name: descriptor.name,
      content: [
        { type: "text", text: `Active window: ${title}. Viewport: ${width} × ${height}.` },
        ...(typeof screenshot === "string"
          ? [
              {
                type: "image_url" as const,
                image_url: { url: screenshot, detail: "high" as const },
              },
            ]
          : []),
      ],
      data: { computerId: result.computer.id, observation: { title, width, height } },
    };
  },
};

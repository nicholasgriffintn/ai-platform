import { pendingTakeover } from "@ngriffin_uk/polychat-library-interactions";
import {
  REQUEST_SECRET_TOOL_NAME,
  SECRET_REQUEST_RENDERER,
  requestSecretInputSchema,
  type RequestSecretInput,
  type SecretRequestViewData,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { normaliseHttpOrigin } from "@ngriffin_uk/polychat-utility-server/urls";

import type { ApiToolDefinition } from "~/types/functions";

export const request_secret: ApiToolDefinition = {
  name: REQUEST_SECRET_TOOL_NAME,
  capabilityHint: "ask the user for an API key or token privately",
  description:
    "Ask the user for an API key, token or webhook secret through a private input that keeps the value out of the conversation. Never ask for secrets in chat. Give a short label, why it is needed and the https origin it will be sent to, such as https://api.example.com. The user's reply contains a one-use secret-ref:<hex> reference that expires after 24 hours. Pass it to call_api as auth.secret_ref; it only works in this conversation and only for the destination given here.",
  type: "normal",
  maxIdenticalCalls: 1,
  permissions: ["human"],
  effects: {
    effectClass: "credential",
    destination: (input) => normaliseHttpOrigin(input.destination) ?? undefined,
  },
  intentEvidence: (input: RequestSecretInput) => ({
    operation: REQUEST_SECRET_TOOL_NAME,
    label: input.label,
    destination: new URL(input.destination).origin,
  }),
  inputSchema: requestSecretInputSchema,
  execute: async (args: RequestSecretInput, context) => {
    if (!context.request.user?.id || !context.toolCallId || !context.completionId) {
      throw new AssistantError(
        "Secrets can only be requested from a signed-in user in a saved conversation",
        ErrorType.PARAMS_ERROR,
      );
    }

    const data: SecretRequestViewData = {
      renderer: SECRET_REQUEST_RENDERER,
      interactionId: context.toolCallId,
      label: args.label,
      purpose: args.purpose,
      destination: new URL(args.destination).origin,
      humanInTheLoop: pendingTakeover({
        interactionId: context.toolCallId,
        toolName: REQUEST_SECRET_TOOL_NAME,
      }),
    };

    return {
      status: "pending",
      name: REQUEST_SECRET_TOOL_NAME,
      content: `Waiting for the user to enter ${args.label} privately. Do not ask for it in chat.`,
      data,
    };
  },
};

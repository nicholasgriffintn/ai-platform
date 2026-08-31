import { createServiceContext } from "~/lib/context/serviceContext";
import { getChatProvider } from "~/lib/providers/capabilities/chat";

import type { ApiToolDefinition } from "../../types/functions";
import { v0_code_generation as v0_code_generationDescriptor } from "./definitions/v0_code_generation";

export const v0_code_generation: ApiToolDefinition = {
  ...v0_code_generationDescriptor,
  execute: async (args, context) => {
    const req = context.request;

    if (!args.prompt) {
      return {
        status: "error",
        name: "v0_code_generation",
        content: "Missing prompt",
        data: {},
      };
    }

    const messages = [];

    if (args.system_prompt) {
      messages.push({
        role: "system",
        content: args.system_prompt,
      });
    }

    if (args.image_base_64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: args.prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${args.image_base_64}`,
            },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: args.prompt,
      });
    }

    const provider = getChatProvider("v0", { env: req.env, user: req.user });
    const serviceContext = createServiceContext({ env: req.env, user: req.user });
    const response = await provider.getResponse(
      {
        model: "v0-1.0-md",
        env: req.env,
        context: serviceContext,
        messages,
      },
      req.user?.id,
    );

    if (!response.data) {
      return {
        status: "error",
        name: "v0_code_generation",
        content: "Error generating code",
        data: {},
      };
    }

    return {
      status: "success",
      name: "v0_code_generation",
      content: "Code generated successfully",
      data: response.data,
    };
  },
};

import { describe, expect, it } from "vitest";

import type { CoreChatOptions, Message } from "~/types";

import { CrisisSignpostValidator } from "../CrisisSignpostValidator";

const crisisMessage: Message = { role: "user", content: "I want to kill myself" };

function validate(options: Partial<CoreChatOptions>, lastMessage: Message = crisisMessage) {
  return new CrisisSignpostValidator().validate(options as CoreChatOptions, { lastMessage });
}

describe("CrisisSignpostValidator", () => {
  it("flags a person's message without reading guardrail settings", async () => {
    const result = await validate({});

    expect(result).toEqual({ validation: { isValid: true }, context: { crisisSignpost: true } });
  });

  it("reads text out of multi-part messages", async () => {
    const result = await validate(
      { trigger: "channel" },
      { role: "user", content: [{ type: "text", text: "I want to die" }] },
    );

    expect(result.context.crisisSignpost).toBe(true);
  });

  it("does not flag runs nobody is attending", async () => {
    await expect(validate({ trigger: "schedule" })).resolves.toMatchObject({ context: {} });
    await expect(validate({ trigger: "delegation" })).resolves.toMatchObject({ context: {} });
  });

  it("leaves structured output intact", async () => {
    const result = await validate({ response_format: { type: "json_object" } });

    expect(result.context.crisisSignpost).toBeUndefined();
  });

  it("never blocks the request", async () => {
    const result = await validate({}, { role: "user", content: "hello" });

    expect(result).toEqual({ validation: { isValid: true }, context: {} });
  });
});

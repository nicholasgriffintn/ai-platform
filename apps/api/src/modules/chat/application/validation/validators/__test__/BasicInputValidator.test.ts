import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ValidationContext } from "~/modules/chat/application/validation/ValidationPipeline";
import { BasicInputValidator } from "~/modules/chat/application/validation/validators/BasicInputValidator";
import type { CoreChatOptions } from "~/types";

vi.mock("~/modules/chat/application/messages/sanitise", () => ({
  sanitiseMessages: vi.fn(),
}));

describe("BasicInputValidator", () => {
  let validator: BasicInputValidator;
  let baseOptions: CoreChatOptions;
  let baseContext: ValidationContext;
  let mockSanitiseMessages: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { sanitiseMessages } = await vi.importMock<
      typeof import("~/modules/chat/application/messages/sanitise")
    >("~/modules/chat/application/messages/sanitise");

    mockSanitiseMessages = vi.mocked(sanitiseMessages);

    validator = new BasicInputValidator();

    const env: any = {
      DB: {} as any,
      AI: {} as any,
    };

    baseOptions = {
      env,
      context: createServiceContext({
        env,
        user: {
          id: 123,
          email: "test@example.com",
        } as any,
      }),
      messages: [
        {
          role: "user",
          content: "Hello world",
        },
      ],
      completion_id: "completion-123",
      platform: "api",
      mode: "normal",
    };

    baseContext = {};
  });

  describe("validate", () => {
    it("should successfully validate with proper messages", async () => {
      const sanitisedMessages = [
        { role: "user", content: "Hello world" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      mockSanitiseMessages.mockReturnValue(sanitisedMessages);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context.sanitisedMessages).toEqual(sanitisedMessages);
      expect(result.context.lastMessage).toEqual({
        role: "user",
        content: "How are you?",
      });
      expect(mockSanitiseMessages).toHaveBeenCalledWith(baseOptions.messages);
    });

    it("should fail validation when messages array is empty", async () => {
      mockSanitiseMessages.mockReturnValue([]);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Messages array is empty or invalid");
      expect(result.validation.validationType).toBe("input");
      expect(result.context).toEqual({});
    });

    it("should fail validation when no valid last message found", async () => {
      const sanitisedMessages = [null, undefined, false] as any;

      mockSanitiseMessages.mockReturnValue(sanitisedMessages);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("No valid last message found");
      expect(result.validation.validationType).toBe("input");
      expect(result.context).toEqual({});
    });
  });
});

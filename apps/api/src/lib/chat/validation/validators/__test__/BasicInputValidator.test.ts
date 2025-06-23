import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoreChatOptions } from "~/types";
import type { ValidationContext } from "../../ValidationPipeline";
import { BasicInputValidator } from "../BasicInputValidator";

vi.mock("~/lib/chat/utils", () => ({
  sanitiseMessages: vi.fn(),
}));

describe("BasicInputValidator", () => {
  let validator: BasicInputValidator;
  let baseOptions: CoreChatOptions;
  let baseContext: ValidationContext;
  let mockSanitiseMessages: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { sanitiseMessages } =
      await vi.importMock<typeof import("~/lib/chat/utils")>(
        "~/lib/chat/utils",
      );
    mockSanitiseMessages = vi.mocked(sanitiseMessages);

    validator = new BasicInputValidator();

    baseOptions = {
      // @ts-expect-error - mock implementation
      env: {
        DB: {} as any,
        AI: {} as any,
      },
      // @ts-expect-error - mock implementation
      user: {
        id: 123,
        email: "test@example.com",
      },
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
      const sanitizedMessages = [
        { role: "user", content: "Hello world" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      mockSanitiseMessages.mockReturnValue(sanitizedMessages);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context.sanitizedMessages).toEqual(sanitizedMessages);
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
      expect(result.validation.error).toBe(
        "Messages array is empty or invalid",
      );
      expect(result.validation.validationType).toBe("input");
      expect(result.context).toEqual({});
    });

    it("should fail validation when messages is not an array", async () => {
      const optionsWithInvalidMessages = {
        ...baseOptions,
        messages: "not an array" as any,
      };

      mockSanitiseMessages.mockReturnValue([]);

      const result = await validator.validate(
        optionsWithInvalidMessages,
        baseContext,
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe(
        "Messages array is empty or invalid",
      );
      expect(result.validation.validationType).toBe("input");
    });

    it("should fail validation when no valid last message found", async () => {
      const sanitizedMessages = [null, undefined, false] as any;

      mockSanitiseMessages.mockReturnValue(sanitizedMessages);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("No valid last message found");
      expect(result.validation.validationType).toBe("input");
      expect(result.context).toEqual({});
    });

    it("should handle single message successfully", async () => {
      const sanitizedMessages = [{ role: "user", content: "Single message" }];

      mockSanitiseMessages.mockReturnValue(sanitizedMessages);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context.sanitizedMessages).toEqual(sanitizedMessages);
      expect(result.context.lastMessage).toEqual({
        role: "user",
        content: "Single message",
      });
    });

    it("should handle messages with complex content", async () => {
      const sanitizedMessages = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            { type: "image", image_url: { url: "data:image/jpeg;base64,..." } },
          ],
        },
      ];

      mockSanitiseMessages.mockReturnValue(sanitizedMessages);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context.lastMessage).toEqual(sanitizedMessages[0]);
    });

    it("should handle undefined messages property", async () => {
      const optionsWithoutMessages = {
        ...baseOptions,
        messages: undefined as any,
      };

      mockSanitiseMessages.mockReturnValue([]);

      const result = await validator.validate(
        optionsWithoutMessages,
        baseContext,
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe(
        "Messages array is empty or invalid",
      );
    });

    it("should handle null messages property", async () => {
      const optionsWithNullMessages = {
        ...baseOptions,
        messages: null as any,
      };

      mockSanitiseMessages.mockReturnValue([]);

      const result = await validator.validate(
        optionsWithNullMessages,
        baseContext,
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe(
        "Messages array is empty or invalid",
      );
    });

    it("should pass through existing context", async () => {
      const sanitizedMessages = [{ role: "user", content: "Test message" }];
      const contextWithExistingData = {
        existingField: "value",
        anotherField: 123,
      };

      mockSanitiseMessages.mockReturnValue(sanitizedMessages);

      const result = await validator.validate(
        baseOptions,
        // @ts-expect-error - mock implementation
        contextWithExistingData,
      );

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({
        sanitizedMessages,
        lastMessage: sanitizedMessages[0],
      });
    });

    it("should handle sanitiseMessages returning falsy value", async () => {
      mockSanitiseMessages.mockReturnValue(null);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe(
        "Messages array is empty or invalid",
      );
    });

    it("should handle messages with empty content", async () => {
      const sanitizedMessages = [
        { role: "user", content: "" },
        { role: "assistant", content: "Response" },
      ];

      mockSanitiseMessages.mockReturnValue(sanitizedMessages);

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context.lastMessage).toEqual({
        role: "assistant",
        content: "Response",
      });
    });
  });
});

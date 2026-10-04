import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ValidationContext } from "~/modules/chat/application/validation/ValidationPipeline";
import { ContextLimitValidator } from "~/modules/chat/application/validation/validators/ContextLimitValidator";
import type { CoreChatOptions } from "~/types";

vi.mock("~/modules/chat/application/messages/attachments", () => ({
  getAllAttachments: vi.fn(),
}));
const contextMocks = vi.hoisted(() => ({
  checkContextWindowLimits: vi.fn(),
  pruneMessagesToFitContext: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-agents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-agents")>()),
  ...contextMocks,
}));
vi.mock("@ngriffin_uk/polychat-utility-server/sanitise", () => ({
  sanitiseInput: vi.fn(),
}));

describe("ContextLimitValidator", () => {
  let validator: ContextLimitValidator;
  let baseOptions: CoreChatOptions;
  let baseContext: ValidationContext;
  let mockCheckContextWindowLimits: any;
  let mockGetAllAttachments: any;
  let mockPruneMessagesToFitContext: any;
  let mockSanitiseInput: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { getAllAttachments } = await vi.importMock<
      typeof import("~/modules/chat/application/messages/attachments")
    >("~/modules/chat/application/messages/attachments");
    const { sanitiseInput } = await vi.importMock<
      typeof import("@ngriffin_uk/polychat-utility-server/sanitise")
    >("@ngriffin_uk/polychat-utility-server/sanitise");

    mockCheckContextWindowLimits = contextMocks.checkContextWindowLimits;
    mockGetAllAttachments = vi.mocked(getAllAttachments);
    mockPruneMessagesToFitContext = contextMocks.pruneMessagesToFitContext;
    mockSanitiseInput = vi.mocked(sanitiseInput);

    validator = new ContextLimitValidator();

    const env: any = {
      DB: {} as any,
      AI: {} as any,
      AWS_REGION: "us-east-1",
    };

    baseOptions = {
      env,
      context: createServiceContext({
        env,
        user: {
          id: 123,
          email: "test@example.com",
          plan_id: "pro",
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

    baseContext = {
      sanitisedMessages: [{ role: "user", content: "Hello world" }],
      lastMessage: { role: "user", content: "Hello world" },
      modelConfig: {
        matchingModel: "claude-3-sonnet",
        provider: "anthropic",
        contextWindow: 200000,
      },
    };

    mockGetAllAttachments.mockReturnValue({
      markdownAttachments: [],
    });

    mockSanitiseInput.mockReturnValue("Hello world");
    mockPruneMessagesToFitContext.mockReturnValue([{ role: "user", content: "Hello world" }]);
    mockCheckContextWindowLimits.mockReturnValue(undefined);
  });

  describe("validate", () => {
    it("should fail validation when sanitisedMessages is missing", async () => {
      const contextWithoutMessages: ValidationContext = {
        lastMessage: { role: "user", content: "Hello world" },
        modelConfig: baseContext.modelConfig,
      };

      const result = await validator.validate(baseOptions, contextWithoutMessages);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Missing required context for validation");
      expect(result.validation.validationType).toBe("context");
      expect(result.context).toEqual({});
    });

    it("should fail validation when lastMessage is missing", async () => {
      const contextWithoutLastMessage: ValidationContext = {
        sanitisedMessages: [{ role: "user", content: "Hello world" }],
        modelConfig: baseContext.modelConfig,
      };

      const result = await validator.validate(baseOptions, contextWithoutLastMessage);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Missing required context for validation");
      expect(result.validation.validationType).toBe("context");
      expect(result.context).toEqual({});
    });

    it("should fail validation when modelConfig is missing", async () => {
      const contextWithoutModelConfig: ValidationContext = {
        sanitisedMessages: [{ role: "user", content: "Hello world" }],
        lastMessage: { role: "user", content: "Hello world" },
      };

      const result = await validator.validate(baseOptions, contextWithoutModelConfig);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Missing required context for validation");
      expect(result.validation.validationType).toBe("context");
      expect(result.context).toEqual({});
    });

    it("should handle content with no text part", async () => {
      const contextWithNoTextContent: ValidationContext = {
        ...baseContext,
        lastMessage: {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }],
        },
      };

      const result = await validator.validate(baseOptions, contextWithNoTextContent);

      expect(result.validation.isValid).toBe(true);
      expect(mockSanitiseInput).toHaveBeenCalledWith("");
    });

    it("should handle markdown attachments", async () => {
      const markdownAttachments = [
        { name: "document.md", markdown: "# Document Title\nContent here" },
        { markdown: "Another document without name" },
      ];

      mockGetAllAttachments.mockReturnValue({
        markdownAttachments,
      });

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context.messageWithContext).toBe(
        "Hello world\n\nContext from attached documents:\n" +
          "# document.md\n# Document Title\nContent here\n\n" +
          "Another document without name",
      );
    });

    it("should handle empty sanitized messages array", async () => {
      const contextWithEmptyMessages = {
        ...baseContext,
        sanitisedMessages: [],
      };

      const result = await validator.validate(baseOptions, contextWithEmptyMessages);

      expect(result.validation.isValid).toBe(true);
      expect(mockPruneMessagesToFitContext).not.toHaveBeenCalled();
    });

    it("should handle checkContextWindowLimits throwing an error", async () => {
      mockCheckContextWindowLimits.mockImplementation(() => {
        throw new Error("Context window exceeded");
      });

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Context window exceeded");
      expect(result.validation.validationType).toBe("context");
      expect(result.context).toEqual({});
    });

    it("should handle error without message", async () => {
      const errorWithoutMessage = new Error();

      errorWithoutMessage.message = undefined;
      mockCheckContextWindowLimits.mockImplementation(() => {
        throw errorWithoutMessage;
      });

      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Context window validation failed");
      expect(result.validation.validationType).toBe("context");
    });
  });
});

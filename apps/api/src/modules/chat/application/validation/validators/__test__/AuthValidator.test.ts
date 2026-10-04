import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { ValidationContext } from "~/modules/chat/application/validation/ValidationPipeline";
import { AuthValidator } from "~/modules/chat/application/validation/validators/AuthValidator";
import type { CoreChatOptions } from "~/types";

describe("AuthValidator", () => {
  let validator: AuthValidator;
  let baseOptions: CoreChatOptions;
  let baseContext: ValidationContext;

  beforeEach(() => {
    vi.clearAllMocks();

    validator = new AuthValidator();

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
    it("should successfully validate with valid user", async () => {
      const result = await validator.validate(baseOptions, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({});
    });

    it("should successfully validate with valid anonymous user", async () => {
      const optionsWithAnonymousUser = {
        ...baseOptions,
        user: undefined,
        anonymousUser: {
          id: "anon-123",
          session_id: "session-456",
        },
      };

      const result = await validator.validate(optionsWithAnonymousUser, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({});
    });

    it("should fail validation when DB binding is missing", async () => {
      const optionsWithoutDB = {
        ...baseOptions,
        env: {
          AI: {},
        },
      };

      // @ts-expect-error - mock implementation
      const result = await validator.validate(optionsWithoutDB, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Missing DB binding");
      expect(result.validation.validationType).toBe("auth");
      expect(result.context).toEqual({});
    });

    it("should fail validation when neither user nor anonymousUser is provided", async () => {
      const optionsWithoutUsers = {
        ...baseOptions,
        context: createServiceContext({ env: baseOptions.env, user: null }),
        anonymousUser: undefined,
      };

      const result = await validator.validate(optionsWithoutUsers, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
      expect(result.context).toEqual({});
    });

    it("should fail validation when user has no id", async () => {
      const optionsWithUserNoId = {
        ...baseOptions,
        context: createServiceContext({
          env: baseOptions.env,
          user: {
            email: "test@example.com",
          } as any,
        }),
      };

      const result = await validator.validate(optionsWithUserNoId, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should fail validation when anonymousUser has no id", async () => {
      const optionsWithAnonymousUserNoId = {
        ...baseOptions,
        context: createServiceContext({ env: baseOptions.env, user: null }),
        anonymousUser: {
          session_id: "session-456",
        } as any,
      };

      const result = await validator.validate(optionsWithAnonymousUserNoId, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should handle empty string user id", async () => {
      const optionsWithEmptyUserId = {
        ...baseOptions,
        context: createServiceContext({
          env: baseOptions.env,
          user: {
            id: "",
            email: "test@example.com",
          } as any,
        }),
      };

      const result = await validator.validate(optionsWithEmptyUserId, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should handle empty string anonymous user id", async () => {
      const optionsWithEmptyAnonymousId = {
        ...baseOptions,
        context: createServiceContext({ env: baseOptions.env, user: null }),
        anonymousUser: {
          id: "",
          session_id: "session-456",
        },
      };

      const result = await validator.validate(optionsWithEmptyAnonymousId, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoreChatOptions } from "~/types";
import type { ValidationContext } from "../../ValidationPipeline";
import { AuthValidator } from "../AuthValidator";

describe("AuthValidator", () => {
  let validator: AuthValidator;
  let baseOptions: CoreChatOptions;
  let baseContext: ValidationContext;

  beforeEach(() => {
    vi.clearAllMocks();

    validator = new AuthValidator();

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

      const result = await validator.validate(
        optionsWithAnonymousUser,
        baseContext,
      );

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

    it("should fail validation when DB is null", async () => {
      const optionsWithNullDB = {
        ...baseOptions,
        env: {
          DB: null,
          AI: {},
        },
      };

      // @ts-expect-error - mock implementation
      const result = await validator.validate(optionsWithNullDB, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Missing DB binding");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should fail validation when DB is undefined", async () => {
      const optionsWithUndefinedDB = {
        ...baseOptions,
        env: {
          DB: undefined,
          AI: {},
        },
      };

      const result = await validator.validate(
        // @ts-expect-error - mock implementation
        optionsWithUndefinedDB,
        baseContext,
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("Missing DB binding");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should fail validation when neither user nor anonymousUser is provided", async () => {
      const optionsWithoutUsers = {
        ...baseOptions,
        user: undefined,
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
        user: {
          email: "test@example.com",
        } as any,
      };

      const result = await validator.validate(optionsWithUserNoId, baseContext);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should fail validation when anonymousUser has no id", async () => {
      const optionsWithAnonymousUserNoId = {
        ...baseOptions,
        user: undefined,
        anonymousUser: {
          session_id: "session-456",
        } as any,
      };

      const result = await validator.validate(
        optionsWithAnonymousUserNoId,
        baseContext,
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should prioritize user over anonymousUser when both are provided", async () => {
      const optionsWithBothUsers = {
        ...baseOptions,
        user: {
          id: "user-123",
          email: "test@example.com",
        },
        anonymousUser: {
          id: "anon-123",
          session_id: "session-456",
        },
      };

      const result = await validator.validate(
        // @ts-expect-error - mock implementation
        optionsWithBothUsers,
        baseContext,
      );

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({});
    });

    it("should handle empty string user id", async () => {
      const optionsWithEmptyUserId = {
        ...baseOptions,
        user: {
          id: "",
          email: "test@example.com",
        },
      };

      const result = await validator.validate(
        // @ts-expect-error - mock implementation
        optionsWithEmptyUserId,
        baseContext,
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should handle empty string anonymous user id", async () => {
      const optionsWithEmptyAnonymousId = {
        ...baseOptions,
        user: undefined,
        anonymousUser: {
          id: "",
          session_id: "session-456",
        },
      };

      const result = await validator.validate(
        optionsWithEmptyAnonymousId,
        baseContext,
      );

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.error).toBe("User or anonymousUser is required");
      expect(result.validation.validationType).toBe("auth");
    });

    it("should handle null user", async () => {
      const optionsWithNullUser = {
        ...baseOptions,
        user: null,
        anonymousUser: {
          id: "anon-123",
          session_id: "session-456",
        },
      };

      const result = await validator.validate(optionsWithNullUser, baseContext);

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({});
    });

    it("should handle null anonymousUser when user is present", async () => {
      const optionsWithNullAnonymousUser = {
        ...baseOptions,
        user: {
          id: "user-123",
          email: "test@example.com",
        },
        anonymousUser: null,
      };

      const result = await validator.validate(
        // @ts-expect-error - mock implementation
        optionsWithNullAnonymousUser,
        baseContext,
      );

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({});
    });

    it("should pass through existing context unchanged", async () => {
      const contextWithExistingData = {
        existingField: "value",
        anotherField: 123,
        nestedObject: { prop: "test" },
      };

      const result = await validator.validate(
        baseOptions,
        // @ts-expect-error - mock implementation
        contextWithExistingData,
      );

      expect(result.validation.isValid).toBe(true);
      expect(result.context).toEqual({});
    });
  });
});

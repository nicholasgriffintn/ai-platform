import type { CoreChatOptions } from "../../core";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "../ValidationPipeline";

export class AuthValidator implements Validator {
  async validate(
    options: CoreChatOptions,
    context: ValidationContext,
  ): Promise<ValidatorResult> {
    const { env, user, anonymousUser } = options;

    if (!env.DB) {
      return {
        validation: {
          isValid: false,
          error: "Missing DB binding",
          validationType: "auth",
        },
        context: {},
      };
    }

    if (!user?.id && !anonymousUser?.id) {
      return {
        validation: {
          isValid: false,
          error: "User or anonymousUser is required",
          validationType: "auth",
        },
        context: {},
      };
    }

    return {
      validation: { isValid: true },
      context: {},
    };
  }
}

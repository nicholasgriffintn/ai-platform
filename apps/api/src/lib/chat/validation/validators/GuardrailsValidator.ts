import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/lib/chat/validation/ValidationPipeline";
import { Database } from "~/lib/database";
import { Guardrails } from "~/lib/guardrails";
import type { CoreChatOptions } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({
  prefix: "CHAT:VALIDATION:VALIDATORS:GUARDRAILS",
});

export class GuardrailsValidator implements Validator {
  async validate(
    options: CoreChatOptions,
    context: ValidationContext,
  ): Promise<ValidatorResult> {
    const { env, user, completion_id } = options;

    if (!context.messageWithContext) {
      return {
        validation: {
          isValid: false,
          error: "Missing message context for guardrails validation",
          validationType: "input",
        },
        context: {},
      };
    }

    try {
      const database = Database.getInstance(env);
      const userSettings = await database.getUserSettings(user?.id);

      const guardrails = Guardrails.getInstance(env, user, userSettings);

      const inputValidation = await guardrails.validateInput(
        context.messageWithContext,
        user?.id,
        completion_id,
      );

      if (!inputValidation?.isValid) {
        logger.error("Guardrails validation failed", {
          inputValidation,
        });
        return {
          validation: {
            isValid: false,
            error:
              inputValidation?.rawResponse?.blockedResponse ||
              "Input did not pass safety checks",
            violations: inputValidation?.violations,
            rawViolations: inputValidation?.rawResponse,
            validationType: "input",
          },
          context: {},
        };
      }

      return {
        validation: { isValid: true },
        context: {
          guardrails,
        },
      };
    } catch (error: any) {
      return {
        validation: {
          isValid: false,
          error: `Guardrails validation failed: ${error.message}`,
          validationType: "input",
        },
        context: {},
      };
    }
  }
}

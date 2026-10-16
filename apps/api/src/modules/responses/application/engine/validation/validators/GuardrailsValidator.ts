import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { memoizeRequest } from "@ngriffin_uk/polychat-utility-server/request-cache";

import { Guardrails } from "~/infrastructure/providers/capabilities/guardrails";
import { getAllAttachments } from "~/modules/responses/application/engine/messages/attachments";
import type {
  ValidationContext,
  Validator,
  ValidatorResult,
} from "~/modules/responses/application/engine/validation/ValidationPipeline";
import { describeGuardrailBlock } from "~/modules/responses/domain/guardrails";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { CoreChatOptions } from "~/types";

const logger = getLogger({
  prefix: "CHAT:VALIDATION:VALIDATORS:GUARDRAILS",
});

export class GuardrailsValidator implements Validator {
  async validate(options: CoreChatOptions, context: ValidationContext): Promise<ValidatorResult> {
    const { env, completion_id } = options;
    const user = options.context?.user;
    const requestCache = options.context?.requestCache;

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
      let userSettings: any = null;

      if (options.context) {
        userSettings = await getRequestUserSettings(options.context);
      } else if (user?.id) {
        userSettings = await memoizeRequest(requestCache, `user-settings:${user.id}`, () =>
          new UserSettingsRepository(env).getUserSettings(user.id),
        );
      }

      const guardrails = new Guardrails(env, user, userSettings);
      const lastMessageContent = Array.isArray(context.lastMessage?.content)
        ? context.lastMessage.content
        : [];
      const images = getAllAttachments(lastMessageContent).imageAttachments.flatMap((image) =>
        image.url ? [{ url: image.url, detail: image.detail }] : [],
      );

      const inputValidation = await guardrails.validateInput(
        {
          text: context.messageWithContext,
          ...(images.length > 0 ? { images } : {}),
        },
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
            error: describeGuardrailBlock("input", inputValidation?.reasons ?? []),
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

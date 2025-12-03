import type {
	ValidationContext,
	Validator,
	ValidatorResult,
} from "~/lib/chat/validation/ValidationPipeline";
import { RepositoryManager } from "~/repositories";
import { Guardrails } from "~/lib/providers/capabilities/guardrails";
import type { CoreChatOptions } from "~/types";
import { getLogger } from "~/utils/logger";
import { memoizeRequest } from "~/utils/requestCache";

const logger = getLogger({
	prefix: "CHAT:VALIDATION:VALIDATORS:GUARDRAILS",
});

export class GuardrailsValidator implements Validator {
	async validate(
		options: CoreChatOptions,
		context: ValidationContext,
	): Promise<ValidatorResult> {
		const { env, user, completion_id } = options;
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
			if (options.context?.getUserSettings) {
				userSettings = await options.context.getUserSettings();
			} else if (user?.id) {
				const repositories = new RepositoryManager(env);
				userSettings = await memoizeRequest(
					requestCache,
					`user-settings:${user.id}`,
					() => repositories.userSettings.getUserSettings(user.id),
				);
			}

			const guardrails = new Guardrails(env, user, userSettings);

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

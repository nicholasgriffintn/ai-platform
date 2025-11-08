import { trackGuardrailViolation } from "~/lib/monitoring";
import type {
	GuardrailResult,
	GuardrailsProvider,
	IEnv,
	IUser,
	IUserSettings,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { providerLibrary } from "~/lib/providers/library";

export class Guardrails {
	private provider: GuardrailsProvider;
	private env: IEnv;
	private userSettings: IUserSettings;

	constructor(env: IEnv, user?: IUser, userSettings?: IUserSettings) {
		this.env = env;
		this.userSettings = userSettings;

		if (!userSettings?.guardrails_enabled) {
			this.provider = null;
		} else if (userSettings?.guardrails_provider === "bedrock") {
			if (!userSettings.bedrock_guardrail_id) {
				throw new AssistantError(
					"Missing required guardrail ID",
					ErrorType.PARAMS_ERROR,
				);
			}

			this.provider = providerLibrary.guardrails("bedrock", {
				env,
				user,
				config: {
					guardrailId: userSettings.bedrock_guardrail_id,
					guardrailVersion: userSettings.bedrock_guardrail_version || "1",
					region: env.AWS_REGION || "us-east-1",
					accessKeyId: env.BEDROCK_AWS_ACCESS_KEY,
					secretAccessKey: env.BEDROCK_AWS_SECRET_KEY,
					env,
				},
			});
		} else if (userSettings?.guardrails_provider === "mistral") {
			this.provider = providerLibrary.guardrails("mistral", {
				env,
				user,
				config: {
					ai: env.AI,
					env,
					user,
				},
			});
		} else {
			this.provider = providerLibrary.guardrails("llamaguard", {
				env,
				user,
				config: {
					ai: env.AI,
					env,
					user,
				},
			});
		}
	}

	async validateInput(
		message: string,
		userId?: number,
		completionId?: string,
	): Promise<GuardrailResult> {
		if (!this.userSettings?.guardrails_enabled) {
			return { provider: "none", isValid: true, violations: [] };
		}
		const result = await this.provider.validateContent(message, "INPUT");
		if (!result?.isValid && result?.violations?.length > 0) {
			trackGuardrailViolation(
				"input_violation",
				{
					message,
					violations: result.violations,
				},
				this.env.ANALYTICS,
				userId,
				completionId,
			);
		}
		return result;
	}

	async validateOutput(
		response: string,
		userId?: number,
		completionId?: string,
	): Promise<GuardrailResult> {
		if (!this.userSettings?.guardrails_enabled) {
			return { provider: "none", isValid: true, violations: [] };
		}
		const result = await this.provider.validateContent(response, "OUTPUT");
		if (!result?.isValid && result?.violations?.length > 0) {
			trackGuardrailViolation(
				"output_violation",
				{
					response,
					violations: result.violations,
				},
				this.env.ANALYTICS,
				userId,
				completionId,
			);
		}
		return result;
	}
}

import type { Ai } from "@cloudflare/workers-types";

import { getAuxiliaryGuardrailsModel } from "~/lib/models";
import type { GuardrailResult, GuardrailsProvider, IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";
import { AssistantError } from "../../utils/errors";
import { AIProviderFactory } from "../providers/factory";

const logger = getLogger({ prefix: "lib/guardrails/llamaguard" });

export interface LlamaGuardConfig {
	ai: Ai;
	env: IEnv;
	user?: IUser;
}

export class LlamaGuardProvider implements GuardrailsProvider {
	private config: LlamaGuardConfig;

	constructor(config: LlamaGuardConfig) {
		this.config = config;
	}

	async validateContent(
		content: string,
		source: "INPUT" | "OUTPUT",
	): Promise<GuardrailResult> {
		try {
			const unsafeCatagories = `<BEGIN UNSAFE CONTENT CATEGORIES>
S1: Violent Crimes. 
S2: Non-Violent Crimes. 
S3: Sex Crimes. 
S4: Child Exploitation. 
S5: Defamation. 
S6: Specialized Advice. 
S7: Privacy. 
S8: Intellectual Property. 
S9: Indiscriminate Weapons. 
S10: Hate. 
S11: Self-Harm. 
S12: Sexual Content. 
S13: Elections. 
<END UNSAFE CONTENT CATEGORIES>`;

			const role = source === "INPUT" ? "user" : "assistant";

			const { model, provider: providerToUse } =
				await getAuxiliaryGuardrailsModel(this.config.env, this.config.user);

			const provider = AIProviderFactory.getProvider(providerToUse);

			const response = await provider.getResponse(
				{
					model,
					env: this.config.env,
					user: this.config.user,
					messages: [
						{
							role: "user",
							content: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>

<|image|> Task: Check if there is unsafe content in '${role}' messages in conversations according to our safety policy with the below categories.

<BEGIN UNSAFE CONTENT CATEGORIES>
${unsafeCatagories}
<END UNSAFE CONTENT CATEGORIES>

<BEGIN CONVERSATION>

${role}: ${content}

<END CONVERSATION>

Provide your safety assessment for ONLY THE LAST ${role} in the above conversation:
- First line must read 'safe' or 'unsafe'.
- If unsafe, a second line must include a comma-separated list of violated categories.<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
						},
					],
				},
				this.config.user?.id,
			);

			const responseText = response.response.toLowerCase().trim();
			const isValid =
				responseText.startsWith("safe") || responseText.includes("allowed");
			const violations = isValid ? [] : [response.response];

			return {
				provider: "llamaguard",
				isValid,
				violations,
				rawResponse: response.response,
			};
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}
			logger.error("LLamaGuard API error:", { error });
		}
	}
}

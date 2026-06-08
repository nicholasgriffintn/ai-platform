import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { MessagingProvider } from "../../capabilities/messaging";
import {
	ensureMessagingCredentials,
	isAwsSmsCredentials,
	isTwilioSmsCredentials,
} from "../../capabilities/messaging";
import { AssistantError, ErrorType } from "~/utils/errors";
import { AwsSmsProvider, TwilioSmsProvider } from "../../capabilities/messaging/providers";

const messagingProviders: ProviderRegistration<MessagingProvider>[] = [
	{
		name: "twilio-sms",
		lifecycle: "transient",
		create: (context) => {
			const credentials = ensureMessagingCredentials(context);
			if (!isTwilioSmsCredentials(credentials)) {
				throw new AssistantError(
					"Twilio SMS credentials are invalid",
					ErrorType.CONFIGURATION_ERROR,
				);
			}
			return new TwilioSmsProvider(credentials);
		},
		metadata: { vendor: "Twilio", categories: ["messaging"], tags: ["sms"] },
	},
	{
		name: "aws-sms",
		lifecycle: "transient",
		create: (context) => {
			const credentials = ensureMessagingCredentials(context);
			if (!isAwsSmsCredentials(credentials)) {
				throw new AssistantError("AWS SMS credentials are invalid", ErrorType.CONFIGURATION_ERROR);
			}
			return new AwsSmsProvider(credentials, context.serviceContext);
		},
		metadata: {
			vendor: "AWS",
			categories: ["messaging"],
			tags: ["sms", "rcs", "end-user-messaging"],
		},
	},
];

export function registerMessagingProviders(registry: ProviderRegistry): void {
	for (const registration of messagingProviders) {
		registry.register("messaging", registration);
	}
}

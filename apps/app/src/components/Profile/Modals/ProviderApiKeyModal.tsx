import { useState } from "react";

import { Button } from "~/components/ui/Button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/Dialog";
import { FormInput } from "~/components/ui/Form/Input";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useUser } from "~/hooks/useUser";

interface ProviderApiKeyModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	providerId: string;
	providerName: string;
}

export function ProviderApiKeyModal({
	open,
	onOpenChange,
	providerId,
	providerName,
}: ProviderApiKeyModalProps) {
	const { trackEvent } = useTrackEvent();
	const [apiKey, setApiKey] = useState("");
	const [secretKey, setSecretKey] = useState("");
	const [fromNumber, setFromNumber] = useState("");
	const [messagingServiceSid, setMessagingServiceSid] = useState("");
	const [region, setRegion] = useState("us-east-1");
	const { storeProviderApiKey, isStoringProviderApiKey } = useUser();

	const isBedrockProvider =
		providerName.toLowerCase() === "polly" || providerName.toLowerCase() === "bedrock";
	const isTwilioSmsProvider = providerId === "twilio-sms";
	const isAwsSmsProvider = providerId === "aws-sms";
	const requiresSecretKey = isBedrockProvider || isTwilioSmsProvider || isAwsSmsProvider;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const providerSecretKey = isTwilioSmsProvider
			? JSON.stringify({ authToken: secretKey, fromNumber, messagingServiceSid })
			: isAwsSmsProvider
				? JSON.stringify({ secretAccessKey: secretKey, region, originationNumber: fromNumber })
				: isBedrockProvider
					? secretKey
					: undefined;

		try {
			trackEvent({
				name: "store_provider_api_key",
				category: "profile",
				label: "enable_provider",
				value: providerId,
			});
			await storeProviderApiKey({
				providerId,
				apiKey,
				secretKey: providerSecretKey,
			});
			setApiKey("");
			setSecretKey("");
			setFromNumber("");
			setMessagingServiceSid("");
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to store API key:", error);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange} width="500px">
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Configure {providerName}</DialogTitle>
					<DialogClose onClick={() => onOpenChange(false)} />
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						{isAwsSmsProvider
							? "Enter your AWS access key, secret, region, and SMS origination details."
							: isTwilioSmsProvider
								? "Enter your Twilio Account SID, Auth Token, and sender details."
								: isBedrockProvider
									? `Enter your AWS Access Key ID and Secret Access Key for ${providerName}.`
									: `Enter your API key for ${providerName}.`}
						This will be securely stored and used for making requests.
					</p>

					<FormInput
						type="password"
						autoComplete="off"
						value={apiKey}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
						placeholder={
							isBedrockProvider || isAwsSmsProvider
								? "Enter your AWS Access Key ID"
								: isTwilioSmsProvider
									? "Enter your Twilio Account SID"
									: "Enter your API key"
						}
						label={
							isBedrockProvider || isAwsSmsProvider
								? "AWS Access Key ID"
								: isTwilioSmsProvider
									? "Twilio Account SID"
									: "API Key"
						}
						description="Your credentials will be encrypted before being stored"
						required
						disabled={isStoringProviderApiKey}
					/>

					{requiresSecretKey && (
						<FormInput
							type="password"
							autoComplete="off"
							value={secretKey}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSecretKey(e.target.value)}
							placeholder={
								isTwilioSmsProvider
									? "Enter your Twilio Auth Token"
									: "Enter your AWS Secret Access Key"
							}
							label={isTwilioSmsProvider ? "Twilio Auth Token" : "AWS Secret Access Key"}
							required
							disabled={isStoringProviderApiKey}
						/>
					)}

					{isTwilioSmsProvider && (
						<>
							<FormInput
								type="text"
								value={fromNumber}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromNumber(e.target.value)}
								placeholder="+15551234567"
								label="From Phone Number"
								disabled={isStoringProviderApiKey}
							/>
							<FormInput
								type="text"
								value={messagingServiceSid}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setMessagingServiceSid(e.target.value)
								}
								placeholder="MG..."
								label="Messaging Service SID (optional)"
								disabled={isStoringProviderApiKey}
							/>
						</>
					)}

					{isAwsSmsProvider && (
						<>
							<FormInput
								type="text"
								value={region}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegion(e.target.value)}
								placeholder="us-east-1"
								label="AWS Region"
								required
								disabled={isStoringProviderApiKey}
							/>
							<FormInput
								type="text"
								value={fromNumber}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromNumber(e.target.value)}
								placeholder="+15551234567"
								label="Origination Number (optional)"
								disabled={isStoringProviderApiKey}
							/>
						</>
					)}

					<div className="flex justify-end space-x-2">
						<Button
							type="button"
							variant="secondary"
							onClick={() => onOpenChange(false)}
							disabled={isStoringProviderApiKey}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={
								!apiKey ||
								(requiresSecretKey && !secretKey) ||
								(isTwilioSmsProvider && !fromNumber && !messagingServiceSid) ||
								(isAwsSmsProvider && !region) ||
								isStoringProviderApiKey
							}
							isLoading={isStoringProviderApiKey}
						>
							Save
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

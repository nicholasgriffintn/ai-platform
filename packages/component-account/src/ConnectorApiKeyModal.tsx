import { FormDialog, Input, Label } from "@ngriffin_uk/polychat-component-ui";
import { useEffect, useState } from "react";

export interface ConnectorApiKeyModalProps {
	open: boolean;
	providerName: string;
	/** Overrides the generic "API key" wording when a connector names its credential. */
	credentialLabel?: string;
	isSubmitting?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (apiKey: string) => Promise<void> | void;
}

export function ConnectorApiKeyModal({
	open,
	providerName,
	credentialLabel,
	isSubmitting = false,
	onOpenChange,
	onSubmit,
}: ConnectorApiKeyModalProps) {
	const [apiKey, setApiKey] = useState("");

	useEffect(() => {
		if (!open) {
			setApiKey("");
		}
	}, [open]);

	const fieldLabel = credentialLabel || "API key";

	return (
		<FormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={`Connect ${providerName}`}
			description={`Store your ${fieldLabel.toLowerCase()} for recipe connectors.`}
			onSubmit={() => onSubmit(apiKey.trim())}
			submitText="Connect"
			isLoading={isSubmitting}
			submitDisabled={!apiKey.trim() || isSubmitting}
		>
			<div className="space-y-2">
				<Label htmlFor="connector-api-key">{fieldLabel}</Label>
				<Input
					id="connector-api-key"
					type="password"
					value={apiKey}
					onChange={(event) => setApiKey(event.target.value)}
					placeholder="Paste key"
					autoComplete="off"
				/>
			</div>
		</FormDialog>
	);
}

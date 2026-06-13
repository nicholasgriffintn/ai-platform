import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { RecipeConnectorProvider } from "@assistant/schemas";
import { FormDialog, Input, Label } from "~/components/ui";
import { useStoreRecipeConnectorApiKey } from "~/hooks/useConnectors";

interface ConnectorApiKeyModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	providerId: RecipeConnectorProvider | null;
	providerName: string;
	credentialLabel?: string;
	onStored: () => Promise<void> | void;
}

export function ConnectorApiKeyModal({
	open,
	onOpenChange,
	providerId,
	providerName,
	credentialLabel,
	onStored,
}: ConnectorApiKeyModalProps) {
	const [apiKey, setApiKey] = useState("");
	const storeApiKey = useStoreRecipeConnectorApiKey();

	useEffect(() => {
		if (!open) {
			setApiKey("");
		}
	}, [open]);

	const handleSubmit = async () => {
		if (!providerId || !apiKey.trim()) {
			return;
		}

		try {
			await storeApiKey.mutateAsync({
				provider: providerId,
				apiKey: apiKey.trim(),
			});
			await onStored();
			toast.success(`${providerName} connected.`);
			onOpenChange(false);
		} catch (error) {
			console.error(error);
			toast.error(`Could not connect ${providerName}.`);
		}
	};

	const fieldLabel = credentialLabel || "API key";

	return (
		<FormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={`Connect ${providerName}`}
			description={`Store your ${fieldLabel.toLowerCase()} for recipe connectors.`}
			onSubmit={handleSubmit}
			submitText="Connect"
			isLoading={storeApiKey.isPending}
			submitDisabled={!apiKey.trim() || storeApiKey.isPending}
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

import {
	Button,
	Card,
	ConfirmationDialog,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	EmptyState,
	FormInput,
	HoverActions,
	ListItem,
	SignInEmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

export interface ApiKeySummary {
	id: string;
	name: string;
	created_at: string;
}

export interface GeneratedApiKey {
	key: string;
	name: string;
}

export interface ApiKeysPanelProps {
	apiKeys: ApiKeySummary[];
	isLoading?: boolean;
	loadErrorMessage?: string;
	requiresSignIn?: boolean;
	onSignIn: () => void;
	onCreate: (name: string | undefined) => void | Promise<void>;
	isCreating?: boolean;
	createErrorMessage?: string;
	generatedKey: GeneratedApiKey | null;
	onDismissGeneratedKey: () => void;
	renderCopyButton: (value: string) => ReactNode;
	onDelete: (keyId: string) => void;
	isDeleting?: boolean;
	deletingKeyId?: string | null;
}

function formatCreatedAt(dateString: string): string {
	try {
		const date = new Date(dateString);
		return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
	} catch {
		return "Invalid Date";
	}
}

function GeneratedApiKeyModal({
	generatedKey,
	onClose,
	renderCopyButton,
}: {
	generatedKey: GeneratedApiKey;
	onClose: () => void;
	renderCopyButton: (value: string) => ReactNode;
}) {
	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{`API Key Created: ${generatedKey.name}`}</DialogTitle>
				</DialogHeader>
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					Please copy your new API key. You won't be able to see it again!
				</p>
				<div className="space-y-4 mt-4">
					<div className="bg-zinc-100 dark:bg-zinc-700 p-3 rounded-md flex items-center justify-between gap-2">
						<code className="text-sm text-zinc-700 dark:text-zinc-200 break-all flex-1">
							{generatedKey.key}
						</code>
						{renderCopyButton(generatedKey.key)}
					</div>
					<p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
						Store this key securely. It grants access to your account.
					</p>
					<div className="flex justify-end">
						<Button variant="primary" onClick={onClose}>
							Done
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function ApiKeysPanel({
	apiKeys,
	isLoading = false,
	loadErrorMessage,
	requiresSignIn = false,
	onSignIn,
	onCreate,
	isCreating = false,
	createErrorMessage,
	generatedKey,
	onDismissGeneratedKey,
	renderCopyButton,
	onDelete,
	isDeleting = false,
	deletingKeyId = null,
}: ApiKeysPanelProps) {
	const [newApiKeyName, setNewApiKeyName] = useState("");
	const [keyToDelete, setKeyToDelete] = useState<ApiKeySummary | null>(null);

	return (
		<div className="space-y-8">
			<Card>
				<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
					<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
						Generate New API Key
					</h3>
					<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
						Create a new key to use with external applications or scripts.
					</p>
				</div>
				<div className="px-6">
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							await onCreate(newApiKeyName || undefined);
							setNewApiKeyName("");
						}}
						className="space-y-4"
					>
						<FormInput
							id="new-api-key-name"
							label="Key Name (Optional)"
							placeholder="e.g., My Script Key"
							value={newApiKeyName}
							onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
								setNewApiKeyName(event.target.value)
							}
							disabled={isCreating}
						/>
						{createErrorMessage && (
							<p className="text-sm text-red-600 dark:text-red-400">Error: {createErrorMessage}</p>
						)}
						<Button type="submit" variant="primary" disabled={isCreating}>
							{isCreating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
								</>
							) : (
								<>
									<Plus className="mr-2 h-4 w-4" /> Generate Key
								</>
							)}
						</Button>
					</form>
				</div>
			</Card>

			<Card>
				<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
					<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
						Existing API Keys
					</h3>
					<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
						Manage your existing API keys. Remember to delete keys that are no longer needed.
					</p>
				</div>
				<div className="px-6">
					{isLoading ? (
						<div className="flex items-center justify-center py-6">
							<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
							<span className="ml-2 text-zinc-500 dark:text-zinc-400">Loading keys...</span>
						</div>
					) : requiresSignIn ? (
						<SignInEmptyState
							title="Sign in to view API keys"
							message="Sign in to manage the API keys connected to your account."
							className="bg-transparent dark:bg-transparent py-6 px-0"
							onSignIn={onSignIn}
						/>
					) : loadErrorMessage ? (
						<p className="text-center text-red-600 dark:text-red-400 py-6">
							Error loading API keys: {loadErrorMessage}
						</p>
					) : apiKeys.length === 0 ? (
						<EmptyState
							message="You haven't generated any API keys yet."
							className="bg-transparent dark:bg-transparent py-6 px-0"
						/>
					) : (
						<ul className="space-y-2">
							{apiKeys.map((key) => (
								<ListItem
									key={key.id}
									label={key.name}
									className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750"
									sublabel={`Created: ${formatCreatedAt(key.created_at)}`}
									actions={
										<HoverActions
											alwaysVisible
											actions={[
												{
													id: "delete",
													icon:
														isDeleting && deletingKeyId === key.id ? (
															<Loader2 size={14} className="animate-spin" />
														) : (
															<Trash2 size={14} />
														),
													label: `Delete API key ${key.name}`,
													onClick: (event) => {
														event.stopPropagation();
														setKeyToDelete(key);
													},
													disabled: isDeleting && deletingKeyId === key.id,
												},
											]}
										/>
									}
								/>
							))}
						</ul>
					)}
				</div>
			</Card>

			{generatedKey && (
				<GeneratedApiKeyModal
					generatedKey={generatedKey}
					onClose={onDismissGeneratedKey}
					renderCopyButton={renderCopyButton}
				/>
			)}

			<ConfirmationDialog
				open={!!keyToDelete}
				onOpenChange={(open) => !open && setKeyToDelete(null)}
				title="Delete API Key"
				description={
					keyToDelete
						? `Are you sure you want to delete the API key "${keyToDelete.name}"? This action cannot be undone.`
						: ""
				}
				confirmText="Delete Key"
				variant="destructive"
				onConfirm={() => {
					if (keyToDelete) onDelete(keyToDelete.id);
					setKeyToDelete(null);
				}}
				isLoading={isDeleting}
			/>
		</div>
	);
}

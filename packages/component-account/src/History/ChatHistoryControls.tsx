import { Button, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

export interface ChatHistoryControlsProps {
	isExporting?: boolean;
	isDeletingLocal?: boolean;
	isDeletingRemote?: boolean;
	onExport: () => void;
	onDeleteLocal: () => void | Promise<void>;
	onDeleteRemote: () => void | Promise<void>;
}

export function ChatHistoryControls({
	isExporting = false,
	isDeletingLocal = false,
	isDeletingRemote = false,
	onExport,
	onDeleteLocal,
	onDeleteRemote,
}: ChatHistoryControlsProps) {
	const [confirming, setConfirming] = useState<"local" | "remote" | null>(null);

	return (
		<div>
			<div className="text-zinc-500 dark:text-zinc-400">
				<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
					Message History
				</h3>
				<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
					Export your history as JSON.
				</p>
				<div className="flex gap-2 mb-4">
					<Button variant="primary" onClick={onExport} disabled={isExporting}>
						{isExporting ? "Exporting..." : "Export JSON"}
					</Button>
				</div>
				{isExporting && (
					<div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
						Exporting please do not close the page...
					</div>
				)}
				<div className="border-b border-zinc-200 dark:border-zinc-800 mb-4" />
				<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">Danger Zone</h3>
				<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
					Permanently delete your history from your local device:
				</p>
				<Button
					variant="destructive"
					onClick={() => setConfirming("local")}
					disabled={isDeletingLocal || isExporting}
				>
					Delete all local chats
				</Button>
				<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
					Permanently delete your history from our servers*:
				</p>
				<Button
					variant="destructive"
					onClick={() => setConfirming("remote")}
					disabled={isDeletingRemote || isExporting}
				>
					Delete all remote chats
				</Button>
				<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4">
					*Please note: The retention policies of our hosting partners may vary.
				</p>
			</div>

			<ConfirmationDialog
				open={confirming === "local"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Delete All Local Conversations"
				description="Are you sure you want to delete all local conversations? This action cannot be undone."
				confirmText="Delete All Local"
				variant="destructive"
				onConfirm={async () => {
					await onDeleteLocal();
					setConfirming(null);
				}}
				isLoading={isDeletingLocal}
			/>

			<ConfirmationDialog
				open={confirming === "remote"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Delete All Remote Conversations"
				description="Are you sure you want to delete all remote conversations? This action cannot be undone. Note: The retention policies of our hosting partners may vary."
				confirmText="Delete All Remote"
				variant="destructive"
				onConfirm={async () => {
					await onDeleteRemote();
					setConfirming(null);
				}}
				isLoading={isDeletingRemote}
			/>
		</div>
	);
}

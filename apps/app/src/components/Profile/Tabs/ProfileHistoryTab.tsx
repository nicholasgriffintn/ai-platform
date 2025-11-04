import { useState } from "react";

import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
	useDeleteAllLocalChats,
	useDeleteAllRemoteChats,
} from "~/hooks/useChat";
import { apiService } from "~/lib/api/api-service";
import { Button, ConfirmationDialog } from "~/components/ui";

export function ProfileHistoryTab() {
	const { trackEvent } = useTrackEvent();

	const deleteAllChats = useDeleteAllLocalChats();
	const deleteAllRemoteChats = useDeleteAllRemoteChats();
	const [isExporting, setIsExporting] = useState(false);

	const [confirmDeleteLocal, setConfirmDeleteLocal] = useState(false);
	const [confirmDeleteRemote, setConfirmDeleteRemote] = useState(false);

	const handleDeleteAllLocalChats = async () => {
		setConfirmDeleteLocal(true);
	};

	const confirmDeleteAllLocalChats = async () => {
		try {
			trackEvent({
				name: "delete_all_local_chats",
				category: "profile",
				label: "delete_all_local_chats",
				value: 1,
			});
			await deleteAllChats.mutateAsync();
			setConfirmDeleteLocal(false);
		} catch (error) {
			console.error("Failed to delete all chats:", error);
		}
	};

	const handleDeleteAllRemoteChats = async () => {
		setConfirmDeleteRemote(true);
	};

	const confirmDeleteAllRemoteChats = async () => {
		try {
			trackEvent({
				name: "delete_all_remote_chats",
				category: "profile",
				label: "delete_all_remote_chats",
				value: 1,
			});
			await deleteAllRemoteChats.mutateAsync();
			setConfirmDeleteRemote(false);
		} catch (error) {
			console.error("Failed to delete all remote chats:", error);
		}
	};

	const handleExportJson = async () => {
		setIsExporting(true);
		try {
			trackEvent({
				name: "export_chat_history_json",
				category: "profile",
				label: "export_chat_history_json",
				value: 1,
			});
			const blob = await apiService.exportChatHistory();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			const ts = new Date().toISOString().replace(/[:.]/g, "-");
			a.href = url;
			a.download = `chat-history-${ts}.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Failed to export chat history:", error);
			alert(
				error instanceof Error
					? error.message
					: "Failed to export chat history. Please try again.",
			);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div>
			<PageHeader>
				<PageTitle title="Chat History" />
			</PageHeader>

			<div>
				<div className="text-zinc-500 dark:text-zinc-400">
					<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
						Message History
					</h3>
					<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
						Export your history as JSON.
					</p>
					<div className="flex gap-2 mb-4">
						<Button
							variant="primary"
							onClick={handleExportJson}
							disabled={isExporting}
						>
							{isExporting ? "Exporting..." : "Export JSON"}
						</Button>
					</div>
					{isExporting && (
						<div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
							Exporting please do not close the page...
						</div>
					)}
					<div className="border-b border-zinc-200 dark:border-zinc-800 mb-4" />
					<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
						Danger Zone
					</h3>
					<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
						Permanently delete your history from your local device:
					</p>
					<Button
						variant="destructive"
						onClick={handleDeleteAllLocalChats}
						disabled={deleteAllChats.isPending || isExporting}
					>
						Delete all local chats
					</Button>
					<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
						Permanently delete your history from our servers*:
					</p>
					<Button
						variant="destructive"
						onClick={handleDeleteAllRemoteChats}
						disabled={deleteAllRemoteChats.isPending || isExporting}
					>
						Delete all remote chats
					</Button>
					<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4">
						*Please note: The retention policies of our hosting partners may
						vary.
					</p>
				</div>
			</div>

			<ConfirmationDialog
				open={confirmDeleteLocal}
				onOpenChange={setConfirmDeleteLocal}
				title="Delete All Local Conversations"
				description="Are you sure you want to delete all local conversations? This action cannot be undone."
				confirmText="Delete All Local"
				variant="destructive"
				onConfirm={confirmDeleteAllLocalChats}
				isLoading={deleteAllChats.isPending}
			/>

			<ConfirmationDialog
				open={confirmDeleteRemote}
				onOpenChange={setConfirmDeleteRemote}
				title="Delete All Remote Conversations"
				description="Are you sure you want to delete all remote conversations? This action cannot be undone. Note: The retention policies of our hosting partners may vary."
				confirmText="Delete All Remote"
				variant="destructive"
				onConfirm={confirmDeleteAllRemoteChats}
				isLoading={deleteAllRemoteChats.isPending}
			/>
		</div>
	);
}

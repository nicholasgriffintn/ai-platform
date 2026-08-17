import { ChatHistoryControls } from "@ngriffin_uk/polychat-component-account";
import { useState } from "react";

import { PageShell } from "~/components/Core/PageShell";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useDeleteAllLocalChats, useDeleteAllRemoteChats } from "~/hooks/useChat";
import { apiService } from "~/lib/api/api-service";

export function ProfileHistoryTab() {
	const { trackEvent } = useTrackEvent();

	const deleteAllChats = useDeleteAllLocalChats();
	const deleteAllRemoteChats = useDeleteAllRemoteChats();
	const [isExporting, setIsExporting] = useState(false);

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
				error instanceof Error ? error.message : "Failed to export chat history. Please try again.",
			);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div>
			<PageShell.Header title="Chat History" />

			<ChatHistoryControls
				isExporting={isExporting}
				isDeletingLocal={deleteAllChats.isPending}
				isDeletingRemote={deleteAllRemoteChats.isPending}
				onExport={handleExportJson}
				onDeleteLocal={async () => {
					try {
						trackEvent({
							name: "delete_all_local_chats",
							category: "profile",
							label: "delete_all_local_chats",
							value: 1,
						});
						await deleteAllChats.mutateAsync();
					} catch (error) {
						console.error("Failed to delete all chats:", error);
					}
				}}
				onDeleteRemote={async () => {
					try {
						trackEvent({
							name: "delete_all_remote_chats",
							category: "profile",
							label: "delete_all_remote_chats",
							value: 1,
						});
						await deleteAllRemoteChats.mutateAsync();
					} catch (error) {
						console.error("Failed to delete all remote chats:", error);
					}
				}}
			/>
		</div>
	);
}

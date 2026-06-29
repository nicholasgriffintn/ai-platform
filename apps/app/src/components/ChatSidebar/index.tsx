import {
	Cloud,
	CloudOff,
	Edit,
	GitBranch,
	Image as ImageIcon,
	Loader2,
	MessageCircle,
	PanelLeftClose,
	PanelLeftOpen,
	SlidersHorizontal,
	SquarePen,
	Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";

import { CanvasSidebarControls } from "~/components/Canvas/CanvasSidebarControls";
import type { CanvasStudioState } from "~/components/Canvas/useCanvasStudio";
import {
	Button,
	ConfirmationDialog,
	FormSelect,
	HoverActions,
	ListItem,
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
	SearchInput,
	SidebarShell,
} from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";
import { useLoadMoreOnIntersect } from "~/hooks/useLoadMoreOnIntersect";
import { useChats, useDeleteChat, useUpdateChatTitle } from "~/hooks/useChat";
import { categorizeItemsByDate } from "~/lib/sidebar";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { Conversation, ConversationArchiveFilter, ConversationSortBy } from "~/types/chat";
import { SidebarFooter } from "../Sidebar/SidebarFooter";
import { ChatSidebarNotifications } from "./ChatSidebarNotifications";

interface ChatSidebarProps {
	canvas?: CanvasStudioState;
	isCanvasMode?: boolean;
	onCanvasModeChange?: (isCanvasMode: boolean) => void;
}

export const ChatSidebar = ({
	canvas,
	isCanvasMode = false,
	onCanvasModeChange,
}: ChatSidebarProps) => {
	const { trackEvent } = useTrackEvent();
	const { sidebarVisible, setSidebarVisible, isMobile } = useUIStore();
	const {
		currentConversationId,
		setCurrentConversationId,
		clearCurrentConversation,
		isAuthenticated,
		isAuthenticationLoading,
		isPro,
		localOnlyMode,
		setLocalOnlyMode,
	} = useChatStore();

	const [searchQuery, setSearchQuery] = useState("");
	const [archiveFilter, setArchiveFilter] = useState<ConversationArchiveFilter>("active");
	const [sortBy, setSortBy] = useState<ConversationSortBy>("updated");
	const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);
	const {
		data: conversations = [],
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
	} = useChats({
		archived: archiveFilter,
		query: debouncedSearchQuery,
		sortBy,
	});
	const deleteChat = useDeleteChat();
	const updateTitle = useUpdateChatTitle();
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const hasListCustomisation = archiveFilter !== "active" || sortBy !== "updated";
	const loadMoreConversations = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);
	const loadMoreRef = useLoadMoreOnIntersect({
		enabled: Boolean(hasNextPage),
		isLoading: isFetchingNextPage,
		onLoadMore: loadMoreConversations,
	});

	const categorizedChats = categorizeItemsByDate(conversations, (c) => {
		if (sortBy === "created" && c.created_at) return new Date(c.created_at);
		if (sortBy === "updated" && c.updated_at) return new Date(c.updated_at);
		if (c.last_message_at) return new Date(c.last_message_at);
		if (c.created_at) return new Date(c.created_at);
		return new Date(0);
	});

	const handleNewChatClick = () => {
		clearCurrentConversation();

		trackEvent({
			name: "new_chat",
			category: "sidebar",
			label: "new_chat",
			value: 1,
		});

		if (isMobile) {
			setSidebarVisible(false);
		}
	};

	const handleConversationClick = (id: string | undefined) => {
		setCurrentConversationId(id);

		trackEvent({
			name: "conversation_click",
			category: "sidebar",
			label: "conversation_click",
			value: 1,
		});

		if (isMobile) {
			setSidebarVisible(false);
		}
	};

	const handleEditTitle = async (completion_id: string, currentTitle: string) => {
		const newTitle = prompt("Enter new title:", currentTitle);
		if (newTitle && newTitle !== currentTitle) {
			try {
				trackEvent({
					name: "edit_title",
					category: "sidebar",
					label: "edit_title",
					value: 1,
				});

				await updateTitle.mutateAsync({ completion_id, title: newTitle });
			} catch (error) {
				console.error("Failed to update title:", error);
				alert("Failed to update title. Please try again.");
			}
		}
	};

	const handleDeleteChat = async (completion_id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setConfirmDelete(completion_id);
	};

	const confirmDeleteChat = async () => {
		if (!confirmDelete) return;

		try {
			trackEvent({
				name: "delete_chat",
				category: "sidebar",
				label: "delete_chat",
				value: 1,
			});

			await deleteChat.mutateAsync(confirmDelete);
			if (currentConversationId === confirmDelete) {
				const firstConversation = conversations.find((c) => c.id !== confirmDelete);
				setCurrentConversationId(firstConversation?.id);
			}
			setConfirmDelete(null);
		} catch (error) {
			console.error("Failed to delete chat:", error);
		}
	};

	const toggleLocalOnlyMode = () => {
		const newMode = !localOnlyMode;
		setLocalOnlyMode(newMode);
		if (window.localStorage) {
			window.localStorage.setItem("localOnlyMode", String(newMode));
		}

		trackEvent({
			name: "toggle_local_only_mode",
			category: "sidebar",
			label: "toggle_local_only_mode",
			value: newMode ? "local-only" : "cloud",
		});
	};

	const toggleCanvasMode = () => {
		onCanvasModeChange?.(!isCanvasMode);

		trackEvent({
			name: isCanvasMode ? "switch_to_chat" : "switch_to_canvas",
			category: "sidebar",
			label: isCanvasMode ? "switch_to_chat" : "switch_to_canvas",
			value: 1,
		});
	};

	const renderConversationGroup = (title: string, conversationsList: Conversation[]) => {
		if (!conversationsList || conversationsList.length === 0) return null;

		return (
			<div key={title}>
				<h3 className="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
					{title}
				</h3>
				<ul className="space-y-1 mb-3">
					{conversationsList.map((conversation) => (
						<ListItem
							key={conversation.id}
							data-id={conversation.id}
							isActive={currentConversationId === conversation.id}
							badge={
								<>
									{(conversation.isLocalOnly || localOnlyMode) && (
										<span className="text-xs text-blue-500 dark:text-blue-400 inline-flex items-center">
											<CloudOff size={14} className="mr-1" />
											<span className="sr-only">Local only</span>
										</span>
									)}
									{conversation.parent_conversation_id && (
										<span
											className="text-xs text-zinc-600 dark:text-zinc-400 inline-flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
											title="Go to original conversation"
											aria-label="Go to original conversation"
											onClick={(e) => {
												e?.stopPropagation();
												handleConversationClick(conversation.parent_conversation_id);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.stopPropagation();
													handleConversationClick(conversation.parent_conversation_id!);
												}
											}}
										>
											<GitBranch size={14} className="mr-1" />
										</span>
									)}
								</>
							}
							label={conversation.title || "New conversation"}
							onClick={() => handleConversationClick(conversation.id)}
							actions={
								conversation.id ? (
									<HoverActions
										actions={[
											{
												id: "edit",
												icon: <Edit size={14} />,
												label: "Edit conversation title",
												onClick: (e) => {
													e.stopPropagation();
													handleEditTitle(conversation.id || "", conversation.title || "");
												},
											},
											{
												id: "delete",
												icon: <Trash2 size={14} />,
												label: "Delete",
												onClick: (e) => {
													e.stopPropagation();
													handleDeleteChat(conversation.id || "", e);
												},
											},
										]}
									/>
								) : undefined
							}
						/>
					))}
				</ul>
			</div>
		);
	};

	const sidebarHeader = (
		<div className="h-[44px]">
			<div className="mx-2 my-2 flex items-center justify-between h-[37px]">
				<Button
					type="button"
					variant="icon"
					title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
					aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
					icon={sidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
					onClick={() => setSidebarVisible(!sidebarVisible)}
				/>

				<div className="flex items-center gap-2">
					{canvas && onCanvasModeChange && (
						<Button
							type="button"
							variant={isCanvasMode ? "iconActive" : "icon"}
							title={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
							aria-label={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
							icon={isCanvasMode ? <MessageCircle size={20} /> : <ImageIcon size={20} />}
							onClick={toggleCanvasMode}
						/>
					)}
					{isAuthenticated && (
						<Button
							type="button"
							variant={localOnlyMode ? "iconActive" : "icon"}
							title={localOnlyMode ? "Switch to cloud mode" : "Switch to local-only mode"}
							aria-label={localOnlyMode ? "Switch to cloud mode" : "Switch to local-only mode"}
							icon={localOnlyMode ? <CloudOff size={20} /> : <Cloud size={20} />}
							onClick={toggleLocalOnlyMode}
						/>
					)}
				</div>
			</div>
		</div>
	);

	return (
		<>
			<SidebarShell
				visible={sidebarVisible}
				isMobile={isMobile}
				onClose={() => setSidebarVisible(false)}
				header={sidebarHeader}
				footer={<SidebarFooter />}
			>
				{sidebarVisible && !isCanvasMode && !isAuthenticationLoading && (
					<div>
						<ChatSidebarNotifications
							isAuthenticated={isAuthenticated}
							isPro={isPro}
							localOnlyMode={localOnlyMode}
						/>
					</div>
				)}

				{isCanvasMode && canvas ? (
					<CanvasSidebarControls canvas={canvas} />
				) : isAuthenticationLoading ? (
					<div className="flex items-center gap-2 p-2">
						<Loader2 size={20} className="animate-spin text-zinc-600 dark:text-zinc-400" />
					</div>
				) : (
					<div>
						<div className="p-2">
							<Button
								type="button"
								variant="primary"
								onClick={handleNewChatClick}
								className="w-full bg-zinc-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700"
								icon={<SquarePen size={20} />}
							>
								New Chat
							</Button>
						</div>
						<div className="px-2 pb-2">
							<Popover>
								<PopoverAnchor asChild>
									<div className="flex items-center gap-2">
										<SearchInput
											value={searchQuery}
											onChange={setSearchQuery}
											placeholder="search..."
											aria-label="Search conversation titles"
											className="min-w-0 flex-1"
										/>
										<PopoverTrigger asChild>
											<button
												type="button"
												className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-off-white text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
												aria-label="Conversation list options"
												title="Conversation list options"
											>
												<SlidersHorizontal size={17} />
												{hasListCustomisation && (
													<span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
												)}
											</button>
										</PopoverTrigger>
									</div>
								</PopoverAnchor>
								<PopoverContent
									align="start"
									sideOffset={6}
									className="w-[var(--radix-popper-anchor-width)] space-y-3 border-zinc-200 bg-off-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
								>
									<FormSelect
										label="State"
										aria-label="Conversation archive filter"
										value={archiveFilter}
										onChange={(event) =>
											setArchiveFilter(event.target.value as ConversationArchiveFilter)
										}
										className="h-8 px-2 py-1 text-xs"
										options={[
											{ value: "active", label: "Active" },
											{ value: "archived", label: "Archived" },
											{ value: "all", label: "All" },
										]}
									/>
									<FormSelect
										label="Sort"
										aria-label="Conversation sort"
										value={sortBy}
										onChange={(event) => setSortBy(event.target.value as ConversationSortBy)}
										className="h-8 px-2 py-1 text-xs"
										options={[
											{ value: "updated", label: "Updated" },
											{ value: "created", label: "Created" },
										]}
									/>
								</PopoverContent>
							</Popover>
						</div>
						{isLoading ? (
							<div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
								Loading conversations...
							</div>
						) : conversations.length === 0 ? (
							<div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
								{searchQuery.trim() ? "No matching conversations" : "No conversations yet"}
							</div>
						) : (
							<div className="p-2">
								{renderConversationGroup("Today", categorizedChats.today)}
								{renderConversationGroup("Yesterday", categorizedChats.yesterday)}
								{renderConversationGroup("This Week", categorizedChats.thisWeek)}
								{renderConversationGroup("This Month", categorizedChats.thisMonth)}
								{renderConversationGroup("Last Month", categorizedChats.lastMonth)}
								{renderConversationGroup("Older", categorizedChats.older)}
								<div ref={loadMoreRef} className="h-8">
									{isFetchingNextPage && (
										<div className="flex justify-center py-2">
											<Loader2
												size={16}
												className="animate-spin text-zinc-500 dark:text-zinc-400"
											/>
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</SidebarShell>

			<ConfirmationDialog
				open={confirmDelete !== null}
				onOpenChange={(open) => !open && setConfirmDelete(null)}
				title="Delete Conversation"
				description="Are you sure you want to delete this conversation? This action cannot be undone."
				confirmText="Delete"
				variant="destructive"
				onConfirm={confirmDeleteChat}
				isLoading={deleteChat.isPending}
			/>
		</>
	);
};

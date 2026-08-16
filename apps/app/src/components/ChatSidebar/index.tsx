import {
	CloudOff,
	Edit,
	GitBranch,
	Grid2X2,
	Image as ImageIcon,
	Loader2,
	MessageCircle,
	Search,
	Settings2,
	SquarePen,
	Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { CanvasSidebarControls } from "~/components/Canvas/CanvasSidebarControls";
import type { CanvasStudioState } from "~/components/Canvas/useCanvasStudio";
import {
	Button,
	ConfirmationDialog,
	HoverActions,
	ListItem,
	SidebarShell,
} from "@ngriffin_uk/polychat-component-ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useLoadMoreOnIntersect } from "@ngriffin_uk/polychat-utility-react";
import { useChats, useDeleteChat, useUpdateChatTitle } from "~/hooks/useChat";
import { categorizeItemsByDate } from "~/lib/sidebar";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { Conversation, ConversationArchiveFilter, ConversationSortBy } from "~/types/chat";
import { SidebarNavButton, SidebarNavLink, SidebarNavSection } from "../Sidebar/SidebarNav";
import { SidebarFooter } from "../Sidebar/SidebarFooter";
import { SidebarHeader } from "../Sidebar/SidebarHeader";
import { ChatSidebarNotifications } from "./ChatSidebarNotifications";
import { ConversationListControls } from "./ConversationListControls";

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
	const navigate = useNavigate();
	const { pathname } = useLocation();
	// The conversation only renders on the chat index, so the sub-pages must route back to it.
	const isConversationRoute = pathname === "/" || pathname === "/chat";
	const { sidebarVisible, setSidebarVisible, isMobile } = useUIStore();
	const {
		currentConversationId,
		setCurrentConversationId,
		clearCurrentConversation,
		setShowSearch,
		isAuthenticated,
		isAuthenticationLoading,
		isPro,
		localOnlyMode,
	} = useChatStore();

	const [archiveFilter, setArchiveFilter] = useState<ConversationArchiveFilter>("active");
	const [sortBy, setSortBy] = useState<ConversationSortBy>("updated");
	const {
		data: conversations = [],
		error: conversationsError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		refetch: refetchConversations,
	} = useChats({
		archived: archiveFilter,
		sortBy,
	});
	const deleteChat = useDeleteChat();
	const updateTitle = useUpdateChatTitle();
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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

	const closeOnMobile = () => {
		if (isMobile) setSidebarVisible(false);
	};

	const handleNewChatClick = () => {
		clearCurrentConversation();

		if (!isConversationRoute) {
			navigate("/chat");
		}

		trackEvent({
			name: "new_chat",
			category: "sidebar",
			label: "new_chat",
			value: 1,
		});

		closeOnMobile();
	};

	const handleConversationClick = (id: string | undefined) => {
		setCurrentConversationId(id);

		if (!isConversationRoute) {
			navigate(id ? `/chat?completion_id=${encodeURIComponent(id)}` : "/chat");
		}

		trackEvent({
			name: "conversation_click",
			category: "sidebar",
			label: "conversation_click",
			value: 1,
		});

		closeOnMobile();
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
				<ul className="mb-3 space-y-1">
					{conversationsList.map((conversation) => (
						<ListItem
							key={conversation.id}
							data-id={conversation.id}
							isActive={isConversationRoute && currentConversationId === conversation.id}
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
		<SidebarHeader
			actions={
				canvas && onCanvasModeChange ? (
					<Button
						type="button"
						variant={isCanvasMode ? "iconActive" : "icon"}
						title={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
						aria-label={isCanvasMode ? "Switch to chat" : "Switch to image generation"}
						icon={isCanvasMode ? <MessageCircle size={20} /> : <ImageIcon size={20} />}
						onClick={toggleCanvasMode}
					/>
				) : undefined
			}
		/>
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
						<div className="px-2 pb-3">
							<SidebarNavSection>
								<SidebarNavButton
									icon={<SquarePen size={17} />}
									isActive={isConversationRoute && !currentConversationId}
									onClick={handleNewChatClick}
								>
									New chat
								</SidebarNavButton>
								<SidebarNavButton
									icon={<Search size={17} />}
									onClick={() => setShowSearch(true)}
									shortcut="⌘K"
								>
									Search
								</SidebarNavButton>
								{isAuthenticated && (
									<>
										<SidebarNavLink
											to="/chat/experiences"
											icon={<Grid2X2 size={16} />}
											onClick={closeOnMobile}
										>
											Experiences
										</SidebarNavLink>
										<SidebarNavLink
											to="/chat/capabilities"
											icon={<Settings2 size={16} />}
											onClick={closeOnMobile}
										>
											Capabilities
										</SidebarNavLink>
									</>
								)}
							</SidebarNavSection>
						</div>
						<div className="px-2 pt-4">
							<div className="flex items-center justify-between px-2 pb-2">
								<p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
									Recent conversations
								</p>
								<ConversationListControls
									archiveFilter={archiveFilter}
									onArchiveFilterChange={setArchiveFilter}
									onSortByChange={setSortBy}
									sortBy={sortBy}
								/>
							</div>
							{isLoading ? (
								<div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
									Loading conversations...
								</div>
							) : conversationsError && conversations.length === 0 ? (
								<div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
									<p>Could not load conversations.</p>
									<Button
										type="button"
										variant="secondary"
										className="mt-2"
										onClick={() => refetchConversations()}
									>
										Retry
									</Button>
								</div>
							) : conversations.length === 0 ? (
								<div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
									No conversations yet.
								</div>
							) : (
								<>
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
								</>
							)}
						</div>
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

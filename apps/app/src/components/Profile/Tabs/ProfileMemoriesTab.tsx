import {
	Loader2,
	Play,
	Sparkles,
	History,
	ChevronDown,
	ChevronUp,
	Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { MemorySynthesis } from "@assistant/schemas";

import { Button } from "~/components/ui";
import { Card } from "~/components/ui/Card";
import { useTasks, useMemorySynthesis } from "~/hooks/useTasks";
import { PageHeader } from "../../Core/PageHeader";
import { PageTitle } from "../../Core/PageTitle";
import { formatDate } from "~/lib/dates";
import { MemoryGroups } from "~/components/MemoryGroups";
import { useMemories } from "~/hooks/useMemory";
import { MemoryList } from "~/components/MemoryList";
import { ConfirmationDialog } from "~/components/ui/ConfirmationDialog";
import { CreateGroupModal } from "~/components/CreateGroupModal";

function SynthesisCard({
	synthesis,
	isHistory = false,
}: {
	synthesis: MemorySynthesis;
	isHistory?: boolean;
}) {
	const [isExpanded, setIsExpanded] = useState(!isHistory);

	return (
		<div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<Sparkles size={16} className="text-purple-600" />
						<span className="font-semibold text-zinc-900 dark:text-zinc-100">
							{isHistory
								? `Version ${synthesis.synthesis_version}`
								: "Active Memory Synthesis"}
						</span>
						{!synthesis.is_active && (
							<span className="text-xs text-zinc-500 dark:text-zinc-400">
								(Superseded)
							</span>
						)}
					</div>
					<div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
						<div>Created: {formatDate(synthesis.created_at)}</div>
						<div>
							Memories: {synthesis.memory_count} |{" "}
							{synthesis.tokens_used ? `Tokens: ${synthesis.tokens_used}` : ""}
						</div>
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsExpanded(!isExpanded)}
					className="p-1"
				>
					{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</Button>
			</div>

			{isExpanded && (
				<div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
					<p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
						{synthesis.synthesis_text}
					</p>
				</div>
			)}
		</div>
	);
}

export function ProfileMemoriesTab() {
	const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
	const [showCreateGroup, setShowCreateGroup] = useState(false);
	const [confirmDeleteMemory, setConfirmDeleteMemory] = useState<string | null>(
		null,
	);

	const { triggerSynthesis, isTriggeringSynthesis } = useTasks();
	const { synthesis, isLoadingSynthesis, history, isLoadingHistory } =
		useMemorySynthesis();
	const {
		memories,
		groups,
		deleteMemory,
		deleteGroup,
		addMemoriesToGroup,
		isDeletingMemory,
		isAddingMemoriesToGroup,
	} = useMemories(selectedGroup || undefined);

	const handleDeleteMemory = async (memoryId: string) => {
		setConfirmDeleteMemory(memoryId);
	};

	const confirmDeleteMemoryAction = () => {
		if (confirmDeleteMemory) {
			deleteMemory(confirmDeleteMemory);
			setConfirmDeleteMemory(null);
		}
	};

	const handleGroupCreated = () => {
		setShowCreateGroup(false);
	};

	const handleDeleteGroup = async (groupId: string) => {
		try {
			await deleteGroup(groupId);
			if (selectedGroup === groupId) {
				setSelectedGroup(null);
			}
		} catch (error) {
			console.error("Failed to delete group:", error);
			alert("Failed to delete group. Please try again.");
		}
	};

	const handleAddMemoriesToGroup = async (
		groupId: string,
		memoryIds: string[],
	) => {
		try {
			await addMemoriesToGroup({ groupId, memoryIds });
		} catch (error) {
			console.error("Failed to add memories to group:", error);
			alert("Failed to add memories to group. Please try again.");
		}
	};

	const handleTriggerSynthesis = async () => {
		try {
			triggerSynthesis(
				{ namespace: "global" },
				{
					onSuccess: (response) => {
						toast.success(`Memory synthesis task created: ${response.task_id}`);
					},
					onError: (error) => {
						const message = `Failed to trigger synthesis: ${error.message || "Unknown error"}`;
						toast.error(message);
						console.error(message, error);
					},
				},
			);
		} catch (error) {
			console.error("Error triggering synthesis:", error);
		}
	};

	return (
		<div>
			<PageHeader>
				<PageTitle title="Memories" />
			</PageHeader>

			<div className="space-y-8">
				<Card>
					<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
						<div className="flex items-center justify-between mb-6">
							<div>
								<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
									Memory Management
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Organize and manage your AI conversation memories
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => setShowCreateGroup(true)}
									className="flex items-center gap-2"
								>
									<Plus className="h-4 w-4" />
									Create Group
								</Button>
							</div>
						</div>
					</div>
					<div className="px-6 space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
							<div className="lg:col-span-1">
								<MemoryGroups
									groups={groups}
									selectedGroup={selectedGroup}
									onGroupSelect={setSelectedGroup}
									onDeleteGroup={handleDeleteGroup}
								/>
							</div>

							<div className="lg:col-span-3">
								<MemoryList
									memories={memories}
									groups={groups}
									selectedGroup={selectedGroup}
									onMemoryDeleted={handleDeleteMemory}
									onAddMemoriesToGroup={handleAddMemoriesToGroup}
									isDeletingMemory={isDeletingMemory}
									isAddingToGroup={isAddingMemoriesToGroup}
								/>
							</div>
						</div>
					</div>
				</Card>
			</div>

			<CreateGroupModal
				isOpen={showCreateGroup}
				onClose={() => setShowCreateGroup(false)}
				onGroupCreated={handleGroupCreated}
			/>

			<ConfirmationDialog
				open={confirmDeleteMemory !== null}
				onOpenChange={(open) => !open && setConfirmDeleteMemory(null)}
				title="Delete Memory"
				description="Are you sure you want to delete this memory? This action cannot be undone."
				confirmText="Delete"
				variant="destructive"
				onConfirm={confirmDeleteMemoryAction}
				isLoading={isDeletingMemory}
			/>

			<div className="space-y-8 mt-6">
				<Card>
					<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
						<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
							Memory Synthesis
						</h3>
						<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
							Consolidate your memories into a coherent summary using AI. This
							helps improve conversation context and memory retrieval.
						</p>
					</div>
					<div className="px-6 space-y-4">
						<Button
							onClick={handleTriggerSynthesis}
							variant="primary"
							disabled={isTriggeringSynthesis}
						>
							{isTriggeringSynthesis ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
									Task...
								</>
							) : (
								<>
									<Play className="mr-2 h-4 w-4" /> Trigger Memory Synthesis
								</>
							)}
						</Button>
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							Note: Memory synthesis runs automatically every day at 2 AM if you
							have 5 or more new memories.
						</p>
					</div>
				</Card>

				{synthesis && (
					<Card>
						<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
							<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								Current Memory Summary
							</h3>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								This summary is used to provide context in your conversations.
							</p>
						</div>
						<div className="px-6">
							{isLoadingSynthesis ? (
								<div className="flex items-center justify-center py-6">
									<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
								</div>
							) : (
								<SynthesisCard synthesis={synthesis} />
							)}
						</div>
					</Card>
				)}

				{history.length > 0 && (
					<Card>
						<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
							<div className="flex items-center gap-2">
								<History size={20} />
								<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
									Synthesis History
								</h3>
							</div>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								Previous versions of your memory synthesis.
							</p>
						</div>
						<div className="px-6">
							{isLoadingHistory ? (
								<div className="flex items-center justify-center py-6">
									<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
								</div>
							) : (
								<div className="space-y-3">
									{history.map((syn) => (
										<SynthesisCard key={syn.id} synthesis={syn} isHistory />
									))}
								</div>
							)}
						</div>
					</Card>
				)}
			</div>
		</div>
	);
}

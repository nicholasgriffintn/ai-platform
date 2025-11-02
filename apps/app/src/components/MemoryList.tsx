import { Trash2, Tag, Plus, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui";
import type { Memory, MemoryGroup } from "~/types/chat";

interface MemoryListProps {
	memories: Memory[];
	groups: MemoryGroup[];
	selectedGroup: string | null;
	onMemoryDeleted: (memoryId: string) => void;
	onAddMemoriesToGroup?: (groupId: string, memoryIds: string[]) => void;
	isDeletingMemory: boolean;
	isAddingToGroup?: boolean;
}

export function MemoryList({
	memories,
	groups,
	selectedGroup,
	onMemoryDeleted,
	onAddMemoriesToGroup,
	isDeletingMemory,
	isAddingToGroup,
}: MemoryListProps) {
	const [selectedMemories, setSelectedMemories] = useState<Set<string>>(
		new Set(),
	);
	const [showAddToGroup, setShowAddToGroup] = useState(false);

	const handleDelete = async (memoryId: string) => {
		onMemoryDeleted(memoryId);
	};

	const toggleMemorySelection = (memoryId: string) => {
		const newSelection = new Set(selectedMemories);
		if (newSelection.has(memoryId)) {
			newSelection.delete(memoryId);
		} else {
			newSelection.add(memoryId);
		}
		setSelectedMemories(newSelection);
	};

	const handleAddToGroup = (groupId: string) => {
		if (onAddMemoriesToGroup && selectedMemories.size > 0) {
			onAddMemoriesToGroup(groupId, Array.from(selectedMemories));
			setSelectedMemories(new Set());
			setShowAddToGroup(false);
		}
	};

	const availableGroups = groups.filter((g) => g.id !== selectedGroup);

	const getCategoryColor = (category: string) => {
		switch (category) {
			case "fact":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
			case "preference":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
			case "schedule":
				return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
			case "general":
				return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
		}
	};

	if (memories.length === 0) {
		return (
			<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-8">
				<div className="text-center">
					<div className="mx-auto h-12 w-12 text-zinc-400 mb-4">
						<Tag className="h-12 w-12" />
					</div>
					<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
						{selectedGroup ? "No memories in this group" : "No memories found"}
					</h3>
					<p className="text-zinc-600 dark:text-zinc-400">
						{selectedGroup
							? "This group doesn't have any memories yet. Add some memories to get started."
							: "You haven't created any memories yet. Start chatting to create memories automatically, or create a group to organize them."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
					{selectedGroup ? "Group Memories" : "All Memories"} ({memories.length}
					)
				</h2>

				{selectedMemories.size > 0 &&
					onAddMemoriesToGroup &&
					availableGroups.length > 0 && (
						<div className="relative">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowAddToGroup(!showAddToGroup)}
								disabled={isAddingToGroup}
								className="flex items-center gap-2"
							>
								<Plus className="h-4 w-4" />
								Add to Group ({selectedMemories.size})
							</Button>

							{showAddToGroup && (
								<div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-2 min-w-48 z-10">
									{availableGroups.map((group) => (
										<button
											key={group.id}
											onClick={() => handleAddToGroup(group.id)}
											disabled={isAddingToGroup}
											className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm text-zinc-800 dark:text-zinc-100 disabled:opacity-50"
										>
											{group.title}
										</button>
									))}
								</div>
							)}
						</div>
					)}
			</div>

			<div className="space-y-2">
				{memories.map((memory) => (
					<div
						key={memory.id}
						className={`bg-white dark:bg-zinc-800 rounded-lg shadow-sm border p-4 transition-colors ${
							selectedMemories.has(memory.id)
								? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20"
								: "border-zinc-200 dark:border-zinc-700"
						}`}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-start gap-3 flex-1 min-w-0">
								{onAddMemoriesToGroup && availableGroups.length > 0 && (
									<button
										onClick={() => toggleMemorySelection(memory.id)}
										className={`flex items-center justify-center w-5 h-5 border-2 rounded mt-0.5 transition-colors ${
											selectedMemories.has(memory.id)
												? "bg-blue-600 border-blue-600 text-white"
												: "border-zinc-300 dark:border-zinc-600 hover:border-blue-500"
										}`}
									>
										{selectedMemories.has(memory.id) && (
											<Check className="h-3 w-3" />
										)}
									</button>
								)}

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-2">
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(memory.category)}`}
										>
											{memory.category}
										</span>
										{memory.group_title && (
											<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
												{memory.group_title}
											</span>
										)}
										<span className="text-xs text-zinc-500 dark:text-zinc-400">
											{new Date(memory.created_at).toLocaleDateString()}
										</span>
									</div>
									<p className="text-zinc-800 dark:text-zinc-100 text-sm leading-normal">
										{memory.text}
									</p>
								</div>
							</div>

							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleDelete(memory.id)}
								disabled={isDeletingMemory}
								className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 shrink-0"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>
				))}
			</div>

			{showAddToGroup && (
				<div
					className="fixed inset-0 z-0"
					onClick={() => setShowAddToGroup(false)}
				/>
			)}
		</div>
	);
}

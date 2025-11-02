import { useState } from "react";

import { FormDialog, Input, Label, Textarea } from "~/components/ui";
import { useMemories } from "~/hooks/useMemory";

interface CreateGroupModalProps {
	isOpen: boolean;
	onClose: () => void;
	onGroupCreated: () => void;
}

export function CreateGroupModal({
	isOpen,
	onClose,
	onGroupCreated,
}: CreateGroupModalProps) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState("");

	const { createGroup, isCreatingGroup } = useMemories();

	const handleSubmit = async () => {
		if (!title.trim()) {
			return;
		}

		createGroup({
			title: title.trim(),
			description: description.trim() || undefined,
			category: category || undefined,
		});

		onGroupCreated();

		setTitle("");
		setDescription("");
		setCategory("");
	};

	return (
		<FormDialog
			open={isOpen}
			onOpenChange={onClose}
			title="Create Memory Group"
			description="Organize your memories by creating a new group"
			onSubmit={handleSubmit}
			submitText="Create Group"
			isLoading={isCreatingGroup}
			submitDisabled={!title.trim()}
		>
			<div className="space-y-4">
				<div>
					<Label htmlFor="title">
						Group Title <span className="text-red-500">*</span>
					</Label>
					<Input
						id="title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Enter group title"
						required
					/>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Describe what this group is for (optional)"
						rows={3}
					/>
				</div>

				<div>
					<Label htmlFor="category">Category</Label>
					<select
						id="category"
						value={category}
						onChange={(e) => setCategory(e.target.value)}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
					>
						<option value="">Select a category</option>
						<option value="fact">Facts</option>
						<option value="preference">Preferences</option>
						<option value="schedule">Schedule</option>
						<option value="general">General</option>
					</select>
					<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
						Categorize your memories for better organization
					</p>
				</div>
			</div>
		</FormDialog>
	);
}

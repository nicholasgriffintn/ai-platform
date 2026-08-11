import { BookOpen, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card } from "~/components/ui";
import { useUpdateProject } from "~/hooks/useWorkspaces";

interface ProjectBriefCardProps {
	canManage: boolean;
	embedded?: boolean;
	instructions: string;
	projectId: string;
}

export function ProjectBriefCard({
	canManage,
	embedded = false,
	instructions,
	projectId,
}: ProjectBriefCardProps) {
	const updateProject = useUpdateProject();
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(instructions);

	useEffect(() => setDraft(instructions), [instructions]);

	const handleSave = async () => {
		await updateProject.mutateAsync({ projectId, input: { instructions: draft } });
		setIsEditing(false);
	};

	const handleCancel = () => {
		setDraft(instructions);
		setIsEditing(false);
	};

	const content = (
		<>
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
						<BookOpen size={17} />
					</div>
					<div>
						<h2 className="text-sm font-semibold">Project brief</h2>
						<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
							Shared instructions for every project conversation.
						</p>
					</div>
				</div>
				{canManage && !isEditing && (
					<Button
						variant="icon"
						icon={<Pencil size={15} />}
						aria-label={instructions ? "Edit project brief" : "Add project brief"}
						title={instructions ? "Edit project brief" : "Add project brief"}
						onClick={() => setIsEditing(true)}
					/>
				)}
			</div>

			{isEditing ? (
				<div className="space-y-3">
					<label htmlFor="project-brief" className="sr-only">
						Project brief
					</label>
					<textarea
						id="project-brief"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						maxLength={8000}
						rows={8}
						autoFocus
						placeholder="Add project context, terminology, constraints, and working preferences."
						className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
					/>
					{updateProject.error && (
						<p className="text-sm text-red-700 dark:text-red-400">{updateProject.error.message}</p>
					)}
					<div className="flex justify-end gap-2">
						<Button variant="secondary" onClick={handleCancel} disabled={updateProject.isPending}>
							Cancel
						</Button>
						<Button onClick={handleSave} isLoading={updateProject.isPending}>
							Save brief
						</Button>
					</div>
				</div>
			) : (
				<p className="whitespace-pre-wrap pl-11 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
					{instructions ||
						(canManage
							? "Add instructions to give every project conversation the same context."
							: "No project instructions have been added.")}
				</p>
			)}
		</>
	);

	return embedded ? (
		<section className="space-y-4 p-5">{content}</section>
	) : (
		<Card className="gap-4 p-5 shadow-none">{content}</Card>
	);
}

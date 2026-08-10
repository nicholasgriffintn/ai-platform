import { BookOpen, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card } from "~/components/ui";
import { useUpdateProject } from "~/hooks/useWorkspaces";

interface ProjectBriefCardProps {
	canManage: boolean;
	instructions: string;
	projectId: string;
}

export function ProjectBriefCard({ canManage, instructions, projectId }: ProjectBriefCardProps) {
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

	return (
		<Card className="p-6 shadow-none">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<BookOpen size={20} className="text-zinc-500" />
					<h2 className="text-sm font-semibold">Project brief</h2>
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
				<p className="whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-400">
					{instructions ||
						(canManage
							? "Add instructions to give every project conversation the same context."
							: "No project instructions have been added.")}
				</p>
			)}
		</Card>
	);
}

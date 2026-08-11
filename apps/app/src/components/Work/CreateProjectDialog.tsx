import { useState } from "react";
import { useNavigate } from "react-router";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FormInput,
} from "~/components/ui";
import { useCreateProject } from "~/hooks/useWorkspaces";

export function CreateProjectDialog({
	workspaceId,
	open,
	onOpenChange,
}: {
	workspaceId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const createProject = useCreateProject();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [instructions, setInstructions] = useState("");

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const project = await createProject.mutateAsync({
			workspaceId,
			input: { name, description, instructions, colour: "#2563EB", codingEnvironment: null },
		});
		onOpenChange(false);
		navigate(`/work/${workspaceId}/projects/${project.id}`);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className="space-y-5">
					<DialogHeader>
						<DialogTitle>Create a project</DialogTitle>
						<DialogDescription>
							Projects contain their own conversations, instructions, and capabilities.
						</DialogDescription>
					</DialogHeader>
					<FormInput
						label="Project name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						minLength={2}
						maxLength={100}
						autoFocus
						required
					/>
					<FormInput
						label="Description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						maxLength={1000}
						placeholder="Describe this project"
					/>
					<div className="space-y-1">
						<label htmlFor="project-instructions" className="text-sm font-medium">
							Project instructions
						</label>
						<textarea
							id="project-instructions"
							value={instructions}
							onChange={(event) => setInstructions(event.target.value)}
							maxLength={8000}
							rows={5}
							className="w-full rounded-md border border-zinc-200 bg-off-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
							placeholder="Add context, terminology, constraints, or working preferences."
						/>
					</div>
					{createProject.error && (
						<p className="text-sm text-red-700">{createProject.error.message}</p>
					)}
					<DialogFooter>
						<Button type="submit" isLoading={createProject.isPending}>
							Create project
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

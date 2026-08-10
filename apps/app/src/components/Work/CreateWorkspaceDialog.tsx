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
import { useCreateWorkspace } from "~/hooks/useWorkspaces";

export function CreateWorkspaceDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const createWorkspace = useCreateWorkspace();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const workspace = await createWorkspace.mutateAsync({ name, description, colour: "#2563EB" });
		onOpenChange(false);
		setName("");
		setDescription("");
		navigate(`/work/${workspace.id}`);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className="space-y-5">
					<DialogHeader>
						<DialogTitle>Create a workspace</DialogTitle>
						<DialogDescription>Workspaces contain projects, members, and access.</DialogDescription>
					</DialogHeader>
					<FormInput
						label="Workspace name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						minLength={2}
						maxLength={80}
						autoFocus
						required
					/>
					<FormInput
						label="Description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						maxLength={500}
						placeholder="Describe this workspace"
					/>
					{createWorkspace.error && (
						<p className="text-sm text-red-700">{createWorkspace.error.message}</p>
					)}
					<DialogFooter>
						<Button type="submit" isLoading={createWorkspace.isPending}>
							Create workspace
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

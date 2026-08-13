import { useEffect, useState } from "react";
import "./styles.css";

export interface ProjectBriefCardProps {
	canManage: boolean;
	embedded?: boolean;
	instructions: string;
	isSaving?: boolean;
	errorMessage?: string;
	onSave: (instructions: string) => Promise<void> | void;
}

export function ProjectBriefCard({
	canManage,
	embedded = false,
	instructions,
	isSaving = false,
	errorMessage,
	onSave,
}: ProjectBriefCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(instructions);
	useEffect(() => setDraft(instructions), [instructions]);

	const cancel = () => {
		setDraft(instructions);
		setIsEditing(false);
	};
	const save = async () => {
		await onSave(draft);
		setIsEditing(false);
	};

	return (
		<section className="polychat-workspace-brief" data-embedded={embedded || undefined}>
			<header>
				<span className="polychat-workspace-brief-icon" aria-hidden="true">
					▤
				</span>
				<div>
					<h2>Project brief</h2>
					<p>Shared instructions for every project conversation.</p>
				</div>
				{canManage && !isEditing && (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						aria-label={instructions ? "Edit project brief" : "Add project brief"}
					>
						Edit
					</button>
				)}
			</header>
			{isEditing ? (
				<div className="polychat-workspace-brief-editor">
					<label htmlFor="polychat-project-brief">Project brief</label>
					<textarea
						id="polychat-project-brief"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						maxLength={8000}
						rows={8}
						autoFocus
						placeholder="Add project context, terminology, constraints, and working preferences."
					/>
					{errorMessage && <p role="alert">{errorMessage}</p>}
					<footer>
						<button type="button" onClick={cancel} disabled={isSaving}>
							Cancel
						</button>
						<button type="button" onClick={save} disabled={isSaving}>
							{isSaving ? "Saving…" : "Save brief"}
						</button>
					</footer>
				</div>
			) : (
				<p className="polychat-workspace-brief-copy">
					{instructions ||
						(canManage
							? "Add instructions to give every project conversation the same context."
							: "No project instructions have been added.")}
				</p>
			)}
		</section>
	);
}

export interface WorkspaceSummary {
	id: string;
	name: string;
	role: "owner" | "admin" | "member";
	description?: string;
}
export function WorkspaceList({
	workspaces,
	activeWorkspaceId,
	onSelect,
}: {
	workspaces: WorkspaceSummary[];
	activeWorkspaceId?: string;
	onSelect: (workspace: WorkspaceSummary) => void;
}) {
	return (
		<ul className="polychat-workspace-list">
			{workspaces.map((workspace) => (
				<li key={workspace.id}>
					<button
						type="button"
						aria-current={workspace.id === activeWorkspaceId ? "page" : undefined}
						onClick={() => onSelect(workspace)}
					>
						<strong>{workspace.name}</strong>
						<span>{workspace.description}</span>
						<small>{workspace.role}</small>
					</button>
				</li>
			))}
		</ul>
	);
}

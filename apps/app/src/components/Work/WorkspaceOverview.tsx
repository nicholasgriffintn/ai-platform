import { ArrowRight, FolderKanban, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { Button, Card } from "~/components/ui";
import { useWorkspace } from "~/hooks/useWorkspaces";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { WorkspaceOverviewSkeleton } from "./WorkLoadingSkeletons";
import { WorkPageShell } from "./WorkPageShell";

export function WorkspaceOverview({ workspaceId }: { workspaceId: string }) {
	const { data: workspace, isLoading, error } = useWorkspace(workspaceId);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isInviteOpen, setIsInviteOpen] = useState(false);

	if (isLoading)
		return (
			<WorkPageShell workspaceId={workspaceId}>
				<WorkspaceOverviewSkeleton />
			</WorkPageShell>
		);
	if (error || !workspace)
		return (
			<WorkPageShell workspaceId={workspaceId}>
				<div className="p-10 text-sm text-red-700">{error?.message ?? "Workspace not found"}</div>
			</WorkPageShell>
		);

	const canManage = workspace.role === "owner" || workspace.role === "admin";

	return (
		<WorkPageShell workspaceId={workspaceId}>
			<main className="container mx-auto max-w-6xl px-4 py-8">
				<PageHeader
					actions={
						canManage
							? [
									{
										label: "Invite",
										icon: <Users size={16} />,
										onClick: () => setIsInviteOpen(true),
										variant: "secondary",
									},
									{
										label: "New project",
										icon: <Plus size={16} />,
										onClick: () => setIsCreateOpen(true),
									},
								]
							: undefined
					}
				>
					<PageTitle title={workspace.name} />
					<p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
						{workspace.description || `Your role: ${workspace.role}`}
					</p>
				</PageHeader>

				<div className="mb-5 flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">Projects</h2>
						<p className="text-sm text-zinc-500">Projects in this workspace.</p>
					</div>
					<Link
						to={`/work/${workspaceId}/members`}
						className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
					>
						{workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"}
					</Link>
				</div>
				{workspace.projects.length === 0 ? (
					<EmptyState
						icon={<FolderKanban size={24} className="text-zinc-400" />}
						title="No projects yet"
						message="Create a project to keep its conversations, instructions, and capabilities together."
						action={
							canManage ? (
								<Button onClick={() => setIsCreateOpen(true)}>Create project</Button>
							) : undefined
						}
						className="min-h-[260px]"
					/>
				) : (
					<div className="grid gap-4 md:grid-cols-2">
						{workspace.projects.map((project) => (
							<Link
								key={project.id}
								to={`/work/${workspaceId}/projects/${project.id}`}
								className="group no-underline"
							>
								<Card className="h-full p-6 transition-colors group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
									<div className="flex items-start justify-between">
										<FolderKanban size={20} className="text-zinc-500" />
										<ArrowRight size={18} className="text-zinc-400" />
									</div>
									<h3 className="mt-4 text-xl font-semibold text-zinc-950 dark:text-white">
										{project.name}
									</h3>
									<p className="min-h-12 text-sm leading-6 text-zinc-500">
										{project.description || "No description"}
									</p>
									<div className="flex gap-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
										<span>
											{project.conversationCount} conversation
											{project.conversationCount > 1 ? "s" : ""}
										</span>
										<span>
											{project.capabilityCount} capabilit{project.capabilityCount > 1 ? "es" : "y"}
										</span>
									</div>
								</Card>
							</Link>
						))}
					</div>
				)}
			</main>
			<CreateProjectDialog
				workspaceId={workspaceId}
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
			/>
			<InviteMemberDialog
				workspaceId={workspaceId}
				canInviteAdmin={workspace.role === "owner"}
				open={isInviteOpen}
				onOpenChange={setIsInviteOpen}
			/>
		</WorkPageShell>
	);
}

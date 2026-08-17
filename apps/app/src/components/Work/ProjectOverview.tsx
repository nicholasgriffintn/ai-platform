import {
	ProjectCapabilitiesCard,
	ProjectOverviewActions,
	ProjectOverviewSkeleton,
} from "@ngriffin_uk/polychat-component-workspaces";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Button, Card, ConfirmationDialog, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { useTemplateMutations } from "~/hooks/useGovernance";
import { useArchiveProject } from "~/hooks/useWorkspaces";
import { getErrorMessage, isAuthenticationError } from "~/lib/errors";
import { useWorkData } from "./WorkContext";
import { ProjectBriefCard } from "./ProjectBriefCard";
import { ProjectCodingEnvironmentCard } from "./ProjectCodingEnvironmentCard";
import { ProjectConversationStarter } from "./ProjectConversationStarter";
import { ProjectKnowledgeCard } from "./ProjectKnowledgeCard";
import { ProjectSchedulesCard } from "./ProjectSchedulesCard";

export function ProjectOverview({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const [isArchiveOpen, setIsArchiveOpen] = useState(false);
	const archiveProject = useArchiveProject();
	const templates = useTemplateMutations(workspaceId);
	const navigate = useNavigate();
	const { projectQuery, workspaceQuery } = useWorkData();
	const { data: project, isLoading, error } = projectQuery;
	const { data: workspace } = workspaceQuery;
	if (isLoading) return <ProjectOverviewSkeleton />;
	if (isAuthenticationError(error)) {
		return (
			<SignInEmptyState
				title="Sign in to view this project"
				message="Sign in to access this project and its conversations."
				className="mx-4 my-8 min-h-[300px]"
			/>
		);
	}
	if (error || !project)
		return <div className="p-10 text-sm text-red-700">{error?.message ?? "Project not found"}</div>;
	const canManage = workspace?.role === "owner" || workspace?.role === "admin";
	const capabilitiesPath = `/work/${workspaceId}/projects/${projectId}/library`;
	const conversationPath = `/work/${workspaceId}/projects/${projectId}/chat`;
	const handleSaveTemplate = async () => {
		try {
			await templates.create.mutateAsync({
				workspaceId,
				kind: "project",
				name: project.name,
				description: project.description,
				configuration: {
					project: {
						name: project.name,
						description: project.description,
						instructions: project.instructions,
						colour: project.colour,
						codingEnvironment: project.codingEnvironment,
					},
					capabilities: project.capabilities.map((capability) => ({
						kind: capability.kind,
						capabilityId: capability.capabilityId,
						configuration: capability.configuration,
					})),
				},
				status: "active",
			});
			toast.success("Project template saved");
		} catch (error) {
			toast.error(getErrorMessage(error, "Unable to save project template"));
		}
	};

	return (
		<>
			<PageShell.Content className="max-w-6xl">
				<PageShell.Header
					title={project.name}
					actionContent={
						<ProjectOverviewActions
							canManage={canManage}
							capabilitiesPath={capabilitiesPath}
							conversationPath={conversationPath}
							isSavingTemplate={templates.create.isPending}
							onArchive={() => setIsArchiveOpen(true)}
							onSaveTemplate={() => void handleSaveTemplate()}
						/>
					}
				/>
				<p className="mb-6 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
					{project.description || "No project description"}
				</p>

				<div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
					<section className="min-w-0 space-y-6">
						<ProjectConversationStarter workspaceId={workspaceId} projectId={projectId} />
						<div>
							<div className="mb-3 flex items-center justify-between">
								<h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
									Recent conversations
								</h2>
								<span className="text-xs text-zinc-400">
									{project.conversationCount} conversations
								</span>
							</div>
							{project.conversations.length === 0 ? (
								<EmptyState
									icon={<MessageSquareText className="text-zinc-400" size={24} />}
									title="No conversations yet"
									message="Start a project conversation to use its instructions and capabilities."
									action={
										<Link to={`/work/${workspaceId}/projects/${projectId}/chat`}>
											<Button variant="primary">New conversation</Button>
										</Link>
									}
									className="min-h-[220px]"
								/>
							) : (
								<div className="space-y-2">
									{project.conversations.map((conversation) => (
										<Link
											key={conversation.id}
											to={`/work/${workspaceId}/projects/${projectId}/chat?completion_id=${conversation.id}`}
											className="group block no-underline hover:!no-underline"
										>
											<Card className="flex-row items-center gap-4 p-4 py-4 shadow-none group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
												<MessageSquareText size={18} className="text-zinc-400" />
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium text-zinc-950 group-hover:underline dark:text-white">
														{conversation.title || "New project conversation"}
													</p>
													<p className="text-xs text-zinc-500">
														{conversation.createdBy.name || "Workspace member"} ·{" "}
														{conversation.messageCount} message
														{conversation.messageCount !== 1 ? "s" : ""}
													</p>
												</div>
												<ArrowRight size={16} className="text-zinc-400" />
											</Card>
										</Link>
									))}
								</div>
							)}
						</div>
					</section>
					<aside>
						<Card className="gap-0 overflow-hidden py-0 shadow-none">
							<ProjectBriefCard
								embedded
								canManage={canManage}
								instructions={project.instructions}
								projectId={projectId}
							/>
							<ProjectKnowledgeCard
								embedded
								workspaceId={workspaceId}
								projectId={projectId}
								canManage={canManage}
							/>
							<ProjectSchedulesCard
								embedded
								workspaceId={workspaceId}
								projectId={projectId}
								capabilities={project.capabilities}
								members={workspace?.members ?? []}
							/>
							<ProjectCodingEnvironmentCard embedded canManage={canManage} project={project} />
							<ProjectCapabilitiesCard
								embedded
								capabilities={project.capabilities}
								capabilityCount={project.capabilityCount}
							/>
						</Card>
					</aside>
				</div>
			</PageShell.Content>
			<ConfirmationDialog
				open={isArchiveOpen}
				onOpenChange={setIsArchiveOpen}
				title="Archive project"
				description={`Archive ${project.name}. Its conversations will no longer appear in this workspace.`}
				confirmText="Archive project"
				variant="destructive"
				isLoading={archiveProject.isPending}
				onConfirm={async () => {
					await archiveProject.mutateAsync({ workspaceId, projectId });
					navigate(`/work/${workspaceId}`, { replace: true });
				}}
			>
				{archiveProject.error && (
					<p className="text-sm text-red-700 dark:text-red-400">{archiveProject.error.message}</p>
				)}
			</ConfirmationDialog>
		</>
	);
}

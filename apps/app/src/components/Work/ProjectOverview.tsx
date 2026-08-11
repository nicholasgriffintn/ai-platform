import { ArrowRight, MessageSquareText, Settings2, SquarePen } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Button, Card } from "~/components/ui";
import { isAuthenticationError } from "~/lib/errors";
import { useWorkData } from "./WorkContext";
import { ProjectBriefCard } from "./ProjectBriefCard";
import { ProjectOverviewSkeleton } from "./WorkLoadingSkeletons";
import { ProjectCodingEnvironmentCard } from "./ProjectCodingEnvironmentCard";

export function ProjectOverview({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
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

	return (
		<>
			<main className="container mx-auto max-w-6xl px-4 py-8">
				<PageHeader>
					<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div>
							<PageTitle title={project.name} />
							<p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
								{project.description || "No project description"}
							</p>
						</div>
						<div className="flex shrink-0 gap-2">
							<Link to={`/work/${workspaceId}/projects/${projectId}/library`}>
								<Button variant="outline" icon={<Settings2 size={16} />}>
									Capabilities
								</Button>
							</Link>
							<Link to={`/work/${workspaceId}/projects/${projectId}/chat`}>
								<Button variant="primary" icon={<SquarePen size={16} />}>
									New conversation
								</Button>
							</Link>
						</div>
					</div>
				</PageHeader>

				<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
					<section>
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
					</section>
					<aside className="space-y-4">
						<ProjectBriefCard
							canManage={canManage}
							instructions={project.instructions}
							projectId={projectId}
						/>
						<ProjectCodingEnvironmentCard canManage={canManage} project={project} />
						<Card className="p-6 shadow-none">
							<Settings2 size={20} className="text-zinc-500" />
							<h2 className="text-sm font-semibold">Project capabilities</h2>
							<p className="text-sm text-zinc-500">{project.capabilityCount} enabled</p>
							<div className="flex flex-wrap gap-2">
								{project.capabilities.map((capability) => (
									<span
										key={capability.id}
										className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-700"
									>
										{capability.capabilityId}
									</span>
								))}
							</div>
						</Card>
					</aside>
				</div>
			</main>
		</>
	);
}

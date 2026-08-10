import { BriefcaseBusiness, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { Button, Card } from "~/components/ui";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { WorkCardGridSkeleton } from "./WorkLoadingSkeletons";
import { WorkPageShell } from "./WorkPageShell";

export function WorkOverview() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data, isLoading } = useWorkspaces();
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

	return (
		<WorkPageShell>
			<main className="container mx-auto max-w-6xl px-4 py-8">
				<PageHeader
					actions={[
						isAuthenticated
							? {
									label: "New workspace",
									icon: <Plus size={17} />,
									onClick: () => setIsCreateOpen(true),
								}
							: {
									label: "Sign in",
									icon: <BriefcaseBusiness size={17} />,
									onClick: () => setShowLoginModal(true),
								},
					]}
				>
					<PageTitle title="Workspaces" />
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						Create and manage shared workspaces.
					</p>
				</PageHeader>

				{isAuthenticated && isLoading && (
					<WorkCardGridSkeleton
						count={6}
						label="Loading workspaces"
						gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
					/>
				)}

				{isAuthenticated && data?.workspaces.length === 0 && (
					<EmptyState
						icon={<BriefcaseBusiness className="text-zinc-400" size={24} />}
						title="No workspaces yet"
						message="Create a workspace to organise projects and invite other people."
						action={<Button onClick={() => setIsCreateOpen(true)}>Create workspace</Button>}
						className="min-h-[260px]"
					/>
				)}

				{data?.workspaces.length ? (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{data.workspaces.map((workspace) => (
							<Link key={workspace.id} to={`/work/${workspace.id}`} className="group no-underline">
								<Card className="h-full p-6 transition-colors group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
									<div className="flex items-start justify-between">
										<div>
											<p className="text-xs capitalize text-zinc-500">{workspace.role}</p>
											<h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
												{workspace.name}
											</h2>
										</div>
										<BriefcaseBusiness size={18} className="text-zinc-400" />
									</div>
									<p className="min-h-10 text-sm leading-5 text-zinc-500">
										{workspace.description || "No description"}
									</p>
									<div className="flex gap-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
										<span>{workspace.projectCount} projects</span>
										<span className="flex items-center gap-1">
											<Users size={13} /> {workspace.memberCount}
										</span>
									</div>
								</Card>
							</Link>
						))}
					</div>
				) : null}
			</main>
			<CreateWorkspaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
		</WorkPageShell>
	);
}

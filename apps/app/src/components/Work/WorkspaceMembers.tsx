import { Clock3, Link2, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Card } from "~/components/ui";
import { isAuthenticationError } from "~/lib/errors";
import { useWorkData } from "./WorkContext";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { WorkspaceMembersSkeleton } from "./WorkLoadingSkeletons";

export function WorkspaceMembers({ workspaceId }: { workspaceId: string }) {
	const { workspaceQuery } = useWorkData();
	const { data: workspace, isLoading, error } = workspaceQuery;
	const [isInviteOpen, setIsInviteOpen] = useState(false);

	if (isLoading) return <WorkspaceMembersSkeleton />;
	if (isAuthenticationError(error)) {
		return (
			<SignInEmptyState
				title="Sign in to view workspace people"
				message="Sign in to manage workspace access and members."
				className="mx-4 my-8 min-h-[300px]"
			/>
		);
	}
	if (error || !workspace)
		return (
			<div className="p-10 text-sm text-red-700">{error?.message ?? "Workspace not found"}</div>
		);
	const canManage = workspace.role === "owner" || workspace.role === "admin";

	return (
		<>
			<main className="container mx-auto max-w-5xl px-4 py-8">
				<PageHeader
					actions={
						canManage
							? [
									{
										label: "Invite person",
										icon: <UserPlus size={16} />,
										onClick: () => setIsInviteOpen(true),
									},
								]
							: undefined
					}
				>
					<PageTitle title="People & access" />
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						Manage access to {workspace.name}.
					</p>
				</PageHeader>
				<Card className="gap-0 overflow-hidden py-0 shadow-none">
					{workspace.members.map((member) => (
						<div
							key={member.userId}
							className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold dark:bg-zinc-800">
								{(member.name || member.email).slice(0, 1).toUpperCase()}
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{member.name || member.email}</p>
								{member.name && <p className="truncate text-xs text-zinc-500">{member.email}</p>}
							</div>
							<span className="flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs capitalize text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
								{member.role === "owner" && <ShieldCheck size={13} />}
								{member.role}
							</span>
						</div>
					))}
				</Card>

				{canManage && workspace.invitations.some((invite) => invite.status === "pending") && (
					<section className="mt-10">
						<h2 className="mb-3 text-sm font-semibold">Pending invitations</h2>
						<Card className="gap-0 overflow-hidden py-0 shadow-none">
							{workspace.invitations
								.filter((invite) => invite.status === "pending")
								.map((invite) => (
									<div
										key={invite.id}
										className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
									>
										<Link2 size={17} className="text-zinc-400" />
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">{invite.email}</p>
											<p className="flex items-center gap-1 text-xs text-zinc-500">
												<Clock3 size={12} /> Expires{" "}
												{new Date(invite.expiresAt).toLocaleDateString()}
											</p>
										</div>
										<span className="text-xs capitalize text-zinc-500">{invite.role}</span>
									</div>
								))}
						</Card>
					</section>
				)}
			</main>
			<InviteMemberDialog
				workspaceId={workspaceId}
				canInviteAdmin={workspace.role === "owner"}
				open={isInviteOpen}
				onOpenChange={setIsInviteOpen}
			/>
		</>
	);
}

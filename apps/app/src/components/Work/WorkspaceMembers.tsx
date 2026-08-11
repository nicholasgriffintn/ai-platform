import { ArrowRightLeft, Clock3, Link2, LogOut, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Button, Card, ConfirmationDialog, FormSelect } from "~/components/ui";
import { useAuthStatus } from "~/hooks/useAuth";
import { useWorkspaceMemberMutations } from "~/hooks/useGovernance";
import { useRevokeWorkspaceInvitation } from "~/hooks/useWorkspaces";
import { isAuthenticationError } from "~/lib/errors";
import { useWorkData } from "./WorkContext";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { WorkspaceMembersSkeleton } from "./WorkLoadingSkeletons";

export function WorkspaceMembers({ workspaceId }: { workspaceId: string }) {
	const { workspaceQuery } = useWorkData();
	const { data: workspace, isLoading, error } = workspaceQuery;
	const [isInviteOpen, setIsInviteOpen] = useState(false);
	const [isLeaveOpen, setIsLeaveOpen] = useState(false);
	const [removeUserId, setRemoveUserId] = useState<number | null>(null);
	const [transferUserId, setTransferUserId] = useState<number | null>(null);
	const revokeInvitation = useRevokeWorkspaceInvitation();
	const memberMutations = useWorkspaceMemberMutations(workspaceId);
	const { user } = useAuthStatus();
	const navigate = useNavigate();

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
	const currentUserId = user?.id ? Number(user.id) : undefined;
	const headerActions = [
		...(canManage
			? [
					{
						label: "Invite person",
						icon: <UserPlus size={16} />,
						onClick: () => setIsInviteOpen(true),
					},
				]
			: []),
		...(workspace.role !== "owner"
			? [
					{
						label: "Leave workspace",
						icon: <LogOut size={16} />,
						variant: "secondary" as const,
						onClick: () => setIsLeaveOpen(true),
					},
				]
			: []),
	];

	return (
		<>
			<main className="container mx-auto max-w-5xl px-4 py-8">
				<PageHeader actions={headerActions}>
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
							{canManage &&
							member.role !== "owner" &&
							currentUserId !== member.userId &&
							!(workspace.role === "admin" && member.role === "admin") ? (
								<FormSelect
									aria-label={`Role for ${member.name || member.email}`}
									fullWidth={false}
									value={member.role}
									onChange={(event) =>
										memberMutations.updateRole.mutate({
											userId: member.userId,
											role: event.target.value as "admin" | "member",
										})
									}
									className="w-28 capitalize"
								>
									<option value="member">Member</option>
									{workspace.role === "owner" ? <option value="admin">Admin</option> : null}
								</FormSelect>
							) : (
								<span className="flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs capitalize text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
									{member.role === "owner" && <ShieldCheck size={13} />}
									{member.role}
								</span>
							)}
							{canManage &&
							member.role !== "owner" &&
							currentUserId !== member.userId &&
							!(workspace.role === "admin" && member.role === "admin") ? (
								<Button
									size="sm"
									variant="ghost"
									icon={<Trash2 size={14} />}
									onClick={() => setRemoveUserId(member.userId)}
								>
									Remove
								</Button>
							) : null}
							{workspace.role === "owner" && member.role !== "owner" ? (
								<Button
									size="sm"
									variant="outline"
									icon={<ArrowRightLeft size={14} />}
									onClick={() => setTransferUserId(member.userId)}
								>
									Make owner
								</Button>
							) : null}
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
										<Button
											type="button"
											size="sm"
											variant="outline"
											icon={<Trash2 size={14} />}
											isLoading={
												revokeInvitation.isPending &&
												revokeInvitation.variables?.invitationId === invite.id
											}
											onClick={() =>
												revokeInvitation.mutate({ workspaceId, invitationId: invite.id })
											}
										>
											Revoke
										</Button>
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
			<ConfirmationDialog
				open={isLeaveOpen}
				onOpenChange={setIsLeaveOpen}
				title="Leave workspace"
				description={`Leave ${workspace.name}? You will lose access to its projects and conversations.`}
				confirmText="Leave workspace"
				variant="destructive"
				isLoading={memberMutations.leave.isPending}
				onConfirm={async () => {
					await memberMutations.leave.mutateAsync();
					navigate("/work");
				}}
			/>
			<ConfirmationDialog
				open={removeUserId !== null}
				onOpenChange={(open) => !open && setRemoveUserId(null)}
				title="Remove workspace member"
				description="Remove this person from the workspace and all of its projects?"
				confirmText="Remove member"
				variant="destructive"
				onConfirm={async () => {
					if (removeUserId !== null) await memberMutations.remove.mutateAsync(removeUserId);
					setRemoveUserId(null);
				}}
			/>
			<ConfirmationDialog
				open={transferUserId !== null}
				onOpenChange={(open) => !open && setTransferUserId(null)}
				title="Transfer workspace ownership"
				description="The new owner will receive full control and your role will become administrator."
				confirmText="Transfer ownership"
				onConfirm={async () => {
					if (transferUserId !== null) await memberMutations.transfer.mutateAsync(transferUserId);
					setTransferUserId(null);
				}}
			/>
		</>
	);
}

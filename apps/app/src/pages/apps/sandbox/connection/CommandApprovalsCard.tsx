import { AlertTriangle } from "lucide-react";

import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import { formatRelativeTime } from "~/lib/dates";

import {
	getApprovalStatusBadgeVariant,
	isApprovalPendingStatus,
} from "./helpers";
import type { ApprovalInstructionItem } from "./types";

interface Props {
	approvals: ApprovalInstructionItem[];
	pendingApprovals: ApprovalInstructionItem[];
	approvalsRunId: string | undefined;
	isInstructionsLoading: boolean;
	instructionsError: unknown;
	isResolvePending: boolean;
	onResolveApproval: (
		approval: ApprovalInstructionItem,
		status: "approved" | "rejected",
	) => void;
}

export function CommandApprovalsCard({
	approvals,
	pendingApprovals,
	approvalsRunId,
	isInstructionsLoading,
	instructionsError,
	isResolvePending,
	onResolveApproval,
}: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Command approvals</CardTitle>
				<CardDescription>
					Approve or reject high-risk commands for the active run.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{pendingApprovals.length > 0 && (
					<div className="rounded-md border border-amber-300/60 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-100">
						<div className="flex items-center gap-2 font-medium">
							<AlertTriangle className="h-4 w-4" />
							Awaiting approval: {pendingApprovals.length} command
							{pendingApprovals.length === 1 ? "" : "s"}
						</div>
					</div>
				)}
				{isInstructionsLoading ? (
					<div className="text-sm text-muted-foreground">
						Loading run instructions...
					</div>
				) : instructionsError ? (
					<Alert variant="destructive">
						<AlertTitle>Unable to load instructions</AlertTitle>
						<AlertDescription>
							{instructionsError instanceof Error
								? instructionsError.message
								: "Unknown error"}
						</AlertDescription>
					</Alert>
				) : approvalsRunId && approvals.length === 0 ? (
					<div className="text-sm text-muted-foreground">
						No command approvals requested for this run.
					</div>
				) : !approvalsRunId ? (
					<div className="text-sm text-muted-foreground">
						Start or select a run to manage approvals.
					</div>
				) : (
					<div className="space-y-2">
						{approvals
							.slice()
							.sort(
								(a, b) =>
									new Date(b.requestedAt).getTime() -
									new Date(a.requestedAt).getTime(),
							)
							.map((approval) => (
								<div
									key={approval.id}
									className="rounded-md border p-3 text-xs"
								>
									<div className="mb-2 flex items-center justify-between gap-2">
										<Badge
											variant={getApprovalStatusBadgeVariant(approval.status)}
										>
											{approval.status}
										</Badge>
										<span className="text-muted-foreground">
											{formatRelativeTime(approval.requestedAt)}
										</span>
									</div>
									<p className="mb-2 break-words font-mono">
										{approval.command}
									</p>
									<div className="space-y-1 text-muted-foreground">
										{approval.escalatedAt && (
											<p>
												Escalated {formatRelativeTime(approval.escalatedAt)}
											</p>
										)}
										{approval.expiresAt && (
											<p>Expires {formatRelativeTime(approval.expiresAt)}</p>
										)}
										{approval.timedOutAt && (
											<p>Timed out {formatRelativeTime(approval.timedOutAt)}</p>
										)}
										{approval.resolutionReason && (
											<p>{approval.resolutionReason}</p>
										)}
									</div>
									{isApprovalPendingStatus(approval.status) && (
										<div className="mt-2 flex items-center gap-2">
											<Button
												variant="primary"
												size="sm"
												onClick={() => onResolveApproval(approval, "approved")}
												isLoading={isResolvePending}
											>
												Approve
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={() => onResolveApproval(approval, "rejected")}
												isLoading={isResolvePending}
											>
												Reject
											</Button>
										</div>
									)}
								</div>
							))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, Button } from "~/components/ui";
import { formatConnectorLabel, readConnectorApprovalRequest } from "~/lib/connector-approval";

interface ConnectorApprovalCardProps {
	data: Record<string, unknown>;
	onResolve?: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
}

export function ConnectorApprovalCard({ data, onResolve }: ConnectorApprovalCardProps) {
	const approval = readConnectorApprovalRequest(data);
	const [resolution, setResolution] = useState<{
		approvalId: string;
		state: "approved" | "rejected";
	} | null>(null);
	const [isResolving, setIsResolving] = useState(false);

	if (!approval) return null;

	const expiresAt = approval.expiresAt ? new Date(approval.expiresAt) : undefined;
	const isExpired =
		approval.state === "expired" || (expiresAt ? expiresAt.getTime() <= Date.now() : false);
	const localResolution =
		resolution?.approvalId === approval.approvalId ? resolution.state : undefined;
	const displayState =
		approval.state !== "pending"
			? approval.state
			: isExpired
				? "expired"
				: (localResolution ?? "pending");
	const isResolved = displayState !== "pending";
	const argumentSummary =
		data.argumentSummary && typeof data.argumentSummary === "object"
			? JSON.stringify(data.argumentSummary, null, 2)
			: undefined;
	const resolve = async (nextResolution: "approved" | "rejected") => {
		if (!onResolve || isExpired) return;
		setIsResolving(true);
		try {
			await onResolve(approval.approvalId, nextResolution);
			setResolution({ approvalId: approval.approvalId, state: nextResolution });
			toast.success(nextResolution === "approved" ? "Action approved" : "Action rejected");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to resolve connector approval");
		} finally {
			setIsResolving(false);
		}
	};

	return (
		<section
			className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/25"
			aria-label="Connector action approval"
		>
			<div className="flex items-start gap-2">
				{displayState === "approved" || displayState === "consumed" ? (
					<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
				) : displayState === "rejected" ? (
					<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
				) : (
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
				)}
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium text-zinc-900 dark:text-zinc-100">
							Approve external action
						</span>
						<Badge variant="outline">{formatConnectorLabel(approval.provider)}</Badge>
					</div>
					<p className="text-zinc-700 dark:text-zinc-300">
						This will run <code className="font-mono text-xs">{approval.operation}</code> using the
						account selected for this connector.
					</p>
					{expiresAt && !Number.isNaN(expiresAt.getTime()) && !isExpired ? (
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							Expires {expiresAt.toLocaleString()}.
						</p>
					) : null}
				</div>
			</div>
			{argumentSummary ? (
				<div className="space-y-1">
					<div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Action details</div>
					<pre className="max-h-48 overflow-auto rounded border border-amber-200/70 bg-white/80 p-2 text-xs text-zinc-800 dark:border-amber-900/60 dark:bg-zinc-950/60 dark:text-zinc-200">
						<code>{argumentSummary}</code>
					</pre>
				</div>
			) : null}

			{isResolved ? (
				<p role="status" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
					{displayState === "consumed"
						? "Action completed."
						: displayState === "expired"
							? "This approval has expired."
							: `Action ${displayState}.`}
				</p>
			) : onResolve && !isExpired ? (
				<div className="flex flex-wrap gap-2">
					<Button
						size="xs"
						variant="primary"
						disabled={isResolving}
						onClick={() => void resolve("approved")}
					>
						Approve and continue
					</Button>
					<Button
						size="xs"
						variant="ghost"
						disabled={isResolving}
						className="text-red-600 hover:text-red-700 dark:text-red-400"
						onClick={() => void resolve("rejected")}
					>
						Reject
					</Button>
				</div>
			) : null}
		</section>
	);
}

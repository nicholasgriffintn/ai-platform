import { AlertTriangle, CheckCircle2, Copy, GitBranch, TerminalSquare } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { Badge, Button, Markdown } from "~/components/ui";
import { formatRelativeTime } from "~/lib/dates";
import { cn } from "~/lib/utils";
import type { SandboxRun } from "~/types/sandbox";
import { describeEvent, getStatusBadgeVariant } from "../utils";
import {
	copyToClipboard,
	getApprovalStatusBadgeVariant,
	getEventDetailLines,
	isApprovalPendingStatus,
	summariseRunResult,
} from "./helpers";
import type { ApprovalInstructionItem, ChatMessage, TimelineEvent } from "./types";

interface SandboxTranscriptProps {
	messages: ChatMessage[];
	timeline: TimelineEvent[];
	selectedRun: SandboxRun | undefined;
	isSelectedRunLoading: boolean;
	targetRunId: string | undefined;
	selectedRunError: unknown;
	latestPlan: { plan: string; updatedAt: string } | null;
	pendingApprovals: ApprovalInstructionItem[];
	approvals: ApprovalInstructionItem[];
	approvalsRunId: string | undefined;
	isInstructionsLoading: boolean;
	instructionsError: unknown;
	isResolvePending: boolean;
	isSubmitting: boolean;
	timelineEndRef: RefObject<HTMLDivElement | null>;
	onResolveApproval: (approval: ApprovalInstructionItem, status: "approved" | "rejected") => void;
}

export function SandboxTranscript({
	messages,
	timeline,
	selectedRun,
	isSelectedRunLoading,
	targetRunId,
	selectedRunError,
	latestPlan,
	pendingApprovals,
	approvals,
	approvalsRunId,
	isInstructionsLoading,
	instructionsError,
	isResolvePending,
	isSubmitting,
	timelineEndRef,
	onResolveApproval,
}: SandboxTranscriptProps) {
	const hasContent =
		messages.length > 0 ||
		timeline.length > 0 ||
		selectedRun ||
		isSelectedRunLoading ||
		Boolean(selectedRunError);

	return (
		<div className="h-full overflow-auto px-4 py-6">
			<div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5">
				{hasContent ? (
					<>
						<RunSummary
							selectedRun={selectedRun}
							isSelectedRunLoading={isSelectedRunLoading}
							targetRunId={targetRunId}
							selectedRunError={selectedRunError}
							isSubmitting={isSubmitting}
						/>

						{messages.map((message) => (
							<ChatBubble key={message.id} message={message} />
						))}

						{latestPlan && <PlanBubble plan={latestPlan.plan} updatedAt={latestPlan.updatedAt} />}

						<ApprovalsBubble
							approvals={approvals}
							pendingApprovals={pendingApprovals}
							approvalsRunId={approvalsRunId}
							isInstructionsLoading={isInstructionsLoading}
							instructionsError={instructionsError}
							isResolvePending={isResolvePending}
							onResolveApproval={onResolveApproval}
						/>

						{timeline.map((entry) => (
							<ActivityBubble key={entry.id} entry={entry} />
						))}
						<div ref={timelineEndRef} />
					</>
				) : (
					<div className="flex flex-1 items-center justify-center py-16 text-center">
						<div>
							<h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
								Sandbox chat
							</h1>
							<p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
								Start a task below or pick a previous run from the sidebar.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function RunSummary({
	selectedRun,
	isSelectedRunLoading,
	targetRunId,
	selectedRunError,
	isSubmitting,
}: {
	selectedRun: SandboxRun | undefined;
	isSelectedRunLoading: boolean;
	targetRunId: string | undefined;
	selectedRunError: unknown;
	isSubmitting: boolean;
}) {
	if (isSelectedRunLoading && targetRunId) {
		return <SystemPanel>Loading run...</SystemPanel>;
	}

	if (selectedRunError) {
		return (
			<SystemPanel tone="danger">
				{selectedRunError instanceof Error
					? selectedRunError.message
					: "Unable to load selected run"}
			</SystemPanel>
		);
	}

	if (!selectedRun) {
		return null;
	}

	return (
		<div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<Badge variant={getStatusBadgeVariant(selectedRun.status)}>
							{isSubmitting ? "live" : selectedRun.status}
						</Badge>
						<span className="truncate font-medium text-zinc-950 dark:text-zinc-50">
							{selectedRun.repo}
						</span>
					</div>
					<p className="mt-2 text-zinc-600 dark:text-zinc-400">{summariseRunResult(selectedRun)}</p>
				</div>
				<div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
					<div>Run {selectedRun.runId}</div>
					<div>{formatRelativeTime(selectedRun.updatedAt)}</div>
				</div>
			</div>
			<div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
				<span>{selectedRun.model}</span>
				{selectedRun.promptStrategy && <span>{selectedRun.promptStrategy}</span>}
				{typeof selectedRun.timeoutSeconds === "number" && (
					<span>{selectedRun.timeoutSeconds}s timeout</span>
				)}
				{typeof selectedRun.result?.branchName === "string" && (
					<span className="inline-flex items-center gap-1">
						<GitBranch className="h-3.5 w-3.5" />
						{selectedRun.result.branchName}
					</span>
				)}
			</div>
			<RunArtifacts selectedRun={selectedRun} />
		</div>
	);
}

function RunArtifacts({ selectedRun }: { selectedRun: SandboxRun }) {
	const diff = typeof selectedRun.result?.diff === "string" ? selectedRun.result.diff : "";
	const logs = typeof selectedRun.result?.logs === "string" ? selectedRun.result.logs : "";

	if (!diff.trim() && !logs.trim()) return null;

	return (
		<div className="mt-4 space-y-2">
			{diff.trim() && (
				<ArtifactDetails
					title="Diff"
					icon={<TerminalSquare className="h-4 w-4" />}
					content={diff}
				/>
			)}
			{logs.trim() && (
				<ArtifactDetails title="Logs" icon={<CheckCircle2 className="h-4 w-4" />} content={logs} />
			)}
		</div>
	);
}

function ArtifactDetails({
	title,
	icon,
	content,
}: {
	title: string;
	icon: ReactNode;
	content: string;
}) {
	return (
		<details className="rounded-md border border-zinc-200 dark:border-zinc-800">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
				<span className="flex items-center gap-2">
					{icon}
					{title}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 gap-1 text-xs"
					onClick={(event) => {
						event.preventDefault();
						void copyToClipboard(content, title);
					}}
				>
					<Copy className="h-3 w-3" />
					Copy
				</Button>
			</summary>
			<pre className="max-h-72 overflow-auto rounded-b-md bg-zinc-950 p-3 text-xs text-zinc-100">
				{content}
			</pre>
		</details>
	);
}

function ChatBubble({ message }: { message: ChatMessage }) {
	const isUser = message.role === "user";
	return (
		<div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
			<div
				className={cn(
					"max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm",
					isUser
						? "rounded-br-md bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
						: "rounded-bl-md border border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
				)}
			>
				<div className="mb-1 text-xs opacity-70">{formatRelativeTime(message.createdAt)}</div>
				{isUser ? (
					<p className="whitespace-pre-wrap break-words">{message.content}</p>
				) : (
					<Markdown className="max-w-none text-sm">{message.content}</Markdown>
				)}
			</div>
		</div>
	);
}

function PlanBubble({ plan, updatedAt }: { plan: string; updatedAt: string }) {
	return (
		<div className="flex justify-start">
			<div className="max-w-[88%] rounded-2xl rounded-bl-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
				<div className="mb-2 text-xs font-medium text-blue-700 dark:text-blue-300">
					Plan updated {formatRelativeTime(updatedAt)}
				</div>
				<Markdown className="max-w-none text-sm">{plan}</Markdown>
			</div>
		</div>
	);
}

function ApprovalsBubble({
	approvals,
	pendingApprovals,
	approvalsRunId,
	isInstructionsLoading,
	instructionsError,
	isResolvePending,
	onResolveApproval,
}: {
	approvals: ApprovalInstructionItem[];
	pendingApprovals: ApprovalInstructionItem[];
	approvalsRunId: string | undefined;
	isInstructionsLoading: boolean;
	instructionsError: unknown;
	isResolvePending: boolean;
	onResolveApproval: (approval: ApprovalInstructionItem, status: "approved" | "rejected") => void;
}) {
	if (isInstructionsLoading || instructionsError || pendingApprovals.length > 0) {
		return (
			<div className="flex justify-start">
				<div className="max-w-[88%] rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
					<div className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
						<AlertTriangle className="h-4 w-4" />
						Command approvals
					</div>
					{isInstructionsLoading ? (
						<p className="text-sm text-amber-800 dark:text-amber-200">Loading approvals...</p>
					) : instructionsError ? (
						<p className="text-sm text-red-700 dark:text-red-300">
							{instructionsError instanceof Error
								? instructionsError.message
								: "Unable to load approvals"}
						</p>
					) : (
						<div className="space-y-2">
							{pendingApprovals.map((approval) => (
								<ApprovalRow
									key={approval.id}
									approval={approval}
									isResolvePending={isResolvePending}
									onResolveApproval={onResolveApproval}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	if (!approvalsRunId || approvals.length === 0) return null;

	const recentResolvedApprovals = approvals
		.filter((approval) => !isApprovalPendingStatus(approval.status))
		.slice(0, 3);

	if (recentResolvedApprovals.length === 0) return null;

	return (
		<div className="flex justify-start">
			<div className="max-w-[88%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
				<div className="mb-2 font-medium">Resolved approvals</div>
				<div className="space-y-2">
					{recentResolvedApprovals.map((approval) => (
						<ApprovalRow
							key={approval.id}
							approval={approval}
							isResolvePending={isResolvePending}
							onResolveApproval={onResolveApproval}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function ApprovalRow({
	approval,
	isResolvePending,
	onResolveApproval,
}: {
	approval: ApprovalInstructionItem;
	isResolvePending: boolean;
	onResolveApproval: (approval: ApprovalInstructionItem, status: "approved" | "rejected") => void;
}) {
	const isPending = isApprovalPendingStatus(approval.status);

	return (
		<div className="rounded-md border border-zinc-200 bg-white/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/70">
			<div className="mb-2 flex items-center justify-between gap-2">
				<Badge variant={getApprovalStatusBadgeVariant(approval.status)}>{approval.status}</Badge>
				<span className="text-zinc-500 dark:text-zinc-400">
					{formatRelativeTime(approval.requestedAt)}
				</span>
			</div>
			<p className="break-words font-mono">{approval.command}</p>
			{isPending && (
				<div className="mt-3 flex items-center gap-2">
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
	);
}

function ActivityBubble({ entry }: { entry: TimelineEvent }) {
	const detailLines = getEventDetailLines(entry.event);

	return (
		<div className="flex justify-start">
			<div className="max-w-[88%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
				<div className="flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
					<span className="font-medium uppercase tracking-wide">{entry.event.type}</span>
					<span>{formatRelativeTime(entry.receivedAt)}</span>
				</div>
				<p className="mt-2 break-words text-zinc-700 dark:text-zinc-300">
					{describeEvent(entry.event)}
				</p>
				{detailLines.length > 0 && (
					<pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
						{detailLines.join("\n\n")}
					</pre>
				)}
			</div>
		</div>
	);
}

function SystemPanel({
	children,
	tone = "neutral",
}: {
	children: ReactNode;
	tone?: "neutral" | "danger";
}) {
	return (
		<div
			className={cn(
				"rounded-lg border px-4 py-3 text-sm",
				tone === "danger"
					? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
					: "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400",
			)}
		>
			{children}
		</div>
	);
}

import { AlertTriangle, CheckCircle2, Clock, GitBranch, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, Button } from "~/components/ui";
import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { submitSandboxRunInstruction } from "~/lib/api/sandbox";

interface SandboxViewProps {
	type: string;
	data: Record<string, unknown>;
}

export function SandboxView({ type, data }: SandboxViewProps) {
	if (type === "sandbox_plan") {
		return (
			<div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
				<div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
					<Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
					<span>Plan</span>
				</div>
				<div className="prose prose-sm max-w-none dark:prose-invert">
					<MemoizedMarkdown>{String(data.plan ?? "")}</MemoizedMarkdown>
				</div>
			</div>
		);
	}

	if (type === "sandbox_result") {
		return <SandboxResultView data={data} />;
	}

	if (type === "sandbox_event") {
		return <SandboxEventView data={data} />;
	}

	return null;
}

function SandboxResultView({ data }: { data: Record<string, unknown> }) {
	const result = asRecord(data.result);
	const diff = typeof result.diff === "string" ? result.diff : "";
	const logs = typeof result.logs === "string" ? result.logs : "";
	const branchName = typeof result.branchName === "string" ? result.branchName : undefined;
	const error =
		typeof result.error === "string"
			? result.error
			: typeof data.error === "string"
				? data.error
				: undefined;
	const isFailed = data.status === "failed" || data.status === "cancelled" || Boolean(error);
	const summary = typeof data.summary === "string" ? data.summary : undefined;

	return (
		<div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
			<div className="flex flex-wrap items-center gap-2">
				{isFailed ? (
					<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
				) : (
					<CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
				)}
				<span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Result</span>
				{typeof data.status === "string" && <Badge variant="outline">{data.status}</Badge>}
				{branchName && (
					<span className="inline-flex min-w-0 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
						<GitBranch className="h-3.5 w-3.5 shrink-0" />
						<span className="truncate">{branchName}</span>
					</span>
				)}
			</div>
			{summary && (
				<div className="prose prose-sm max-w-none dark:prose-invert">
					<MemoizedMarkdown>{summary}</MemoizedMarkdown>
				</div>
			)}
			{error && (
				<div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
					{String(error)}
				</div>
			)}
			{diff.trim() && <CodeBlock label="Diff" language="diff" value={diff} />}
			{logs.trim() && <CodeBlock label="Logs" value={logs} />}
		</div>
	);
}

function SandboxEventView({ data }: { data: Record<string, unknown> }) {
	const [resolutionStatus, setResolutionStatus] = useState<"approved" | "rejected" | null>(null);
	const [isResolving, setIsResolving] = useState(false);
	const event = asRecord(data.event);
	const eventType = typeof data.type === "string" ? data.type : "";
	const approvalStatus =
		typeof event.approvalStatus === "string" ? event.approvalStatus : undefined;
	const approvalRequired =
		(eventType === "command_approval_requested" || eventType === "command_approval_escalated") &&
		(!approvalStatus || approvalStatus === "pending" || approvalStatus === "escalated") &&
		!resolutionStatus;
	const output = typeof event.output === "string" ? event.output : "";
	const runId = typeof event.runId === "string" ? event.runId : undefined;
	const approvalId =
		typeof event.approvalId === "string"
			? event.approvalId
			: typeof event.instructionId === "string"
				? event.instructionId
				: undefined;
	const command = typeof event.command === "string" ? event.command : undefined;

	const resolveApproval = async (status: "approved" | "rejected") => {
		if (!runId || !approvalId) return;
		setIsResolving(true);
		try {
			await submitSandboxRunInstruction({
				runId,
				kind: "approval_response",
				requestId: approvalId,
				command,
				approvalStatus: status,
			});
			setResolutionStatus(status);
			toast.success(status === "approved" ? "Command approved" : "Command rejected");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to resolve command approval");
		} finally {
			setIsResolving(false);
		}
	};

	return (
		<div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
			<div className="flex min-w-0 items-center gap-2">
				{approvalRequired ? (
					<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
				) : (
					<Terminal className="h-4 w-4 text-blue-500 dark:text-blue-400" />
				)}
				<span className="min-w-0 truncate font-medium text-zinc-900 dark:text-zinc-100">
					{String(data.description ?? data.type ?? "Sandbox event")}
				</span>
			</div>
			{typeof event.command === "string" && event.command.trim() && (
				<code className="block overflow-x-auto rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
					{event.command}
				</code>
			)}
			{typeof event.path === "string" && event.path.trim() && (
				<div className="text-xs text-zinc-500 dark:text-zinc-400">{event.path}</div>
			)}
			{output.trim() && <CodeBlock label={String(event.stream ?? "Output")} value={output} />}
			{typeof event.error === "string" && event.error.trim() && (
				<div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
					{event.error}
				</div>
			)}
			{approvalRequired && runId && approvalId && (
				<div className="flex flex-wrap items-center gap-2 pt-1">
					<Button
						type="button"
						size="xs"
						variant="outline"
						onClick={() => void resolveApproval("approved")}
						disabled={isResolving}
					>
						Approve
					</Button>
					<Button
						type="button"
						size="xs"
						variant="ghost"
						onClick={() => void resolveApproval("rejected")}
						disabled={isResolving}
						className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
					>
						Reject
					</Button>
				</div>
			)}
			{resolutionStatus && (
				<div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
					Approval {resolutionStatus}.
				</div>
			)}
		</div>
	);
}

function CodeBlock({
	label,
	value,
	language,
}: {
	label: string;
	value: string;
	language?: string;
}) {
	return (
		<div className="space-y-1">
			<div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
			<pre className="max-h-96 overflow-auto rounded border border-zinc-200 bg-white p-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
				<code className={language ? `language-${language}` : undefined}>{value}</code>
			</pre>
		</div>
	);
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

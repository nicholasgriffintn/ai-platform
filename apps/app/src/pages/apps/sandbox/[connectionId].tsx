import { useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	LoaderCircle,
	Play,
	Square,
	TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
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
	Checkbox,
	Input,
	Label,
	Textarea,
} from "~/components/ui";
import {
	SANDBOX_QUERY_KEYS,
	useSandboxConnections,
	useSandboxRuns,
} from "~/hooks/useSandbox";
import { formatRelativeTime } from "~/lib/dates";
import { streamSandboxRun } from "~/lib/api/sandbox";
import { cn } from "~/lib/utils";
import type {
	SandboxRun,
	SandboxRunEvent,
	SandboxRunStatus,
} from "~/types/sandbox";

interface TimelineEvent {
	id: string;
	receivedAt: string;
	event: SandboxRunEvent;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
}

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

const statusBadgeVariant: Record<
	SandboxRunStatus,
	"outline" | "secondary" | "destructive"
> = {
	completed: "outline",
	failed: "destructive",
	cancelled: "secondary",
	queued: "secondary",
	running: "secondary",
};

function describeEvent(event: SandboxRunEvent): string {
	switch (event.type) {
		case "run_started":
			return "Run started";
		case "planning_started":
			return "Generating implementation plan";
		case "planning_completed":
			return "Plan generated";
		case "command_batch_ready":
			return `Prepared ${event.commandTotal ?? "?"} commands`;
		case "command_started":
			return `Running command ${event.commandIndex ?? "?"}/${event.commandTotal ?? "?"}: ${event.command ?? ""}`;
		case "command_completed":
			return `Completed command ${event.commandIndex ?? "?"}/${event.commandTotal ?? "?"}`;
		case "command_failed":
			return `Command failed: ${event.command ?? "unknown command"}`;
		case "repo_clone_started":
			return "Cloning repository";
		case "repo_clone_completed":
			return "Repository cloned";
		case "git_branch_created":
			return `Created branch ${event.branchName ?? ""}`.trim();
		case "diff_generated":
			return "Generated code diff";
		case "commit_created":
			return `Created commit on ${event.branchName ?? "feature branch"}`;
		case "run_completed":
			return "Run completed successfully";
		case "run_failed":
			return `Run failed: ${event.error ?? "Unknown error"}`;
		default:
			return event.message || event.type;
	}
}

function summariseRunResult(run: SandboxRun): string {
	if (run.result?.summary && typeof run.result.summary === "string") {
		return run.result.summary;
	}
	if (typeof run.result?.error === "string") {
		return run.result.error;
	}
	if (run.status === "completed") {
		return "Run completed.";
	}
	if (run.status === "failed") {
		return run.error || "Run failed.";
	}
	return "Run in progress.";
}

export function meta() {
	return [
		{ title: "Sandbox Run Console - Polychat" },
		{
			name: "description",
			content:
				"Run implementation tasks against a connected GitHub repository and follow streamed sandbox progress.",
		},
	];
}

export default function SandboxConnectionPage() {
	const navigate = useNavigate();
	const params = useParams();
	const queryClient = useQueryClient();
	const abortControllerRef = useRef<AbortController | null>(null);
	const activeRunIdRef = useRef<string | undefined>(undefined);

	const installationId = Number(params.connectionId);
	const hasValidInstallationId =
		Number.isFinite(installationId) && installationId > 0;

	const { data: connections = [], isLoading, error } = useSandboxConnections();
	const {
		data: runs = [],
		isLoading: isRunsLoading,
		error: runsError,
	} = useSandboxRuns(
		{
			installationId: hasValidInstallationId ? installationId : undefined,
			limit: 30,
		},
		{
			enabled: hasValidInstallationId,
		},
	);

	const [repo, setRepo] = useState("");
	const [task, setTask] = useState("");
	const [model, setModel] = useState("");
	const [shouldCommit, setShouldCommit] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [activeRunId, setActiveRunId] = useState<string | undefined>();
	const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
	const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);

	const connection = useMemo(
		() =>
			connections.find(
				(item) =>
					hasValidInstallationId && item.installationId === installationId,
			),
		[connections, hasValidInstallationId, installationId],
	);

	useEffect(() => {
		if (!connection) {
			return;
		}
		if (!repo && connection.repositories.length > 0) {
			setRepo(connection.repositories[0]);
		}
	}, [connection, repo]);

	const selectedRun = useMemo(() => {
		const targetRunId = selectedRunId || activeRunId;
		if (!targetRunId) {
			return undefined;
		}
		return runs.find((run) => run.runId === targetRunId);
	}, [runs, selectedRunId, activeRunId]);

	const canSubmit = useMemo(() => {
		return (
			!isSubmitting &&
			Boolean(task.trim()) &&
			Boolean(repo.trim()) &&
			REPO_PATTERN.test(repo.trim())
		);
	}, [isSubmitting, task, repo]);

	const handleCancelRun = () => {
		const controller = abortControllerRef.current;
		if (!controller) {
			return;
		}
		controller.abort();
		abortControllerRef.current = null;
		activeRunIdRef.current = undefined;
		setIsSubmitting(false);
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: "assistant",
				content:
					"Streaming was cancelled in this browser tab. The sandbox run may continue server-side.",
				createdAt: new Date().toISOString(),
			},
		]);
	};

	const handleRunTask = async () => {
		const trimmedRepo = repo.trim();
		const trimmedTask = task.trim();
		if (!REPO_PATTERN.test(trimmedRepo)) {
			toast.error("Repository must be in owner/repo format");
			return;
		}
		if (!trimmedTask) {
			toast.error("Describe the task you want to run");
			return;
		}
		if (!connection) {
			toast.error("Connection not found");
			return;
		}

		const controller = new AbortController();
		abortControllerRef.current = controller;
		setIsSubmitting(true);
		setActiveRunId(undefined);
		activeRunIdRef.current = undefined;
		setSelectedRunId(undefined);
		setTimeline([]);
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: "user",
				content: trimmedTask,
				createdAt: new Date().toISOString(),
			},
		]);
		setTask("");

		try {
			await streamSandboxRun(
				{
					installationId: connection.installationId,
					repo: trimmedRepo,
					task: trimmedTask,
					model: model.trim() || undefined,
					shouldCommit,
				},
				{
					signal: controller.signal,
					onEvent: (event) => {
						const eventId = crypto.randomUUID();
						const receivedAt = new Date().toISOString();

						setTimeline((prev) => {
							const next = [...prev, { id: eventId, receivedAt, event }];
							if (next.length > 300) {
								return next.slice(next.length - 300);
							}
							return next;
						});

						if (event.runId) {
							if (!activeRunIdRef.current) {
								activeRunIdRef.current = event.runId;
								setActiveRunId(event.runId);
							}
						}

						if (event.type === "run_completed") {
							const summary =
								typeof event.result?.summary === "string"
									? event.result.summary
									: "Sandbox run completed.";
							setMessages((prev) => [
								...prev,
								{
									id: crypto.randomUUID(),
									role: "assistant",
									content: summary,
									createdAt: receivedAt,
								},
							]);
						}

						if (event.type === "run_failed") {
							setMessages((prev) => [
								...prev,
								{
									id: crypto.randomUUID(),
									role: "assistant",
									content: event.error || "Sandbox run failed.",
									createdAt: receivedAt,
								},
							]);
						}
					},
					onComplete: (finalEvent) => {
						setIsSubmitting(false);
						abortControllerRef.current = null;

						if (finalEvent?.runId) {
							setSelectedRunId(finalEvent.runId);
						} else if (activeRunIdRef.current) {
							setSelectedRunId(activeRunIdRef.current);
						}

						queryClient.invalidateQueries({
							queryKey: SANDBOX_QUERY_KEYS.root,
						});
					},
				},
			);
		} catch (streamError) {
			const asError = streamError as Error;
			if (asError.name !== "AbortError") {
				toast.error(asError.message || "Failed to run sandbox task");
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: asError.message || "Failed to run sandbox task",
						createdAt: new Date().toISOString(),
					},
				]);
			}
			setIsSubmitting(false);
			abortControllerRef.current = null;
			activeRunIdRef.current = undefined;
			queryClient.invalidateQueries({ queryKey: SANDBOX_QUERY_KEYS.root });
		}
	};

	if (!hasValidInstallationId) {
		return (
			<PageShell
				sidebarContent={<AppsSidebarContent />}
				className="max-w-7xl mx-auto"
			>
				<Alert variant="destructive">
					<AlertTitle>Invalid connection id</AlertTitle>
					<AlertDescription>
						The sandbox connection URL is invalid. Return to{" "}
						<Link to="/apps/sandbox" className="underline">
							Sandbox Worker
						</Link>
						.
					</AlertDescription>
				</Alert>
			</PageShell>
		);
	}

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<PageHeader>
					<BackLink to="/apps/sandbox" label="Back to Sandbox Worker" />
					<PageTitle title={`Installation ${installationId}`} />
					<p className="text-sm text-muted-foreground">
						Submit implementation tasks and stream command-level progress from
						the sandbox worker.
					</p>
				</PageHeader>
			}
		>
			{isLoading ? (
				<div className="text-sm text-muted-foreground">
					Loading connection...
				</div>
			) : error ? (
				<Alert variant="destructive">
					<AlertTitle>Unable to load connection</AlertTitle>
					<AlertDescription>
						{error instanceof Error ? error.message : "Unknown error"}
					</AlertDescription>
				</Alert>
			) : !connection ? (
				<EmptyState
					icon={<AlertCircle className="h-8 w-8 text-zinc-400" />}
					title="Connection not found"
					message="This installation is not available in your account."
					action={
						<Button variant="primary" onClick={() => navigate("/apps/sandbox")}>
							Back to sandbox
						</Button>
					}
					className="min-h-[360px]"
				/>
			) : (
				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Run a task</CardTitle>
								<CardDescription>
									Connected App ID {connection.appId}. Enter a repo task and
									stream progress live.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="sandbox-repo-input">Repository</Label>
										<Input
											id="sandbox-repo-input"
											list="sandbox-repo-options"
											value={repo}
											onChange={(event) => setRepo(event.target.value)}
											placeholder="owner/repo"
										/>
										<datalist id="sandbox-repo-options">
											{connection.repositories.map((repository) => (
												<option key={repository} value={repository} />
											))}
										</datalist>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sandbox-model-input">
											Model (optional override)
										</Label>
										<Input
											id="sandbox-model-input"
											value={model}
											onChange={(event) => setModel(event.target.value)}
											placeholder="e.g. mistral-large"
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="sandbox-task-input">Task</Label>
									<Textarea
										id="sandbox-task-input"
										rows={5}
										value={task}
										onChange={(event) => setTask(event.target.value)}
										placeholder="Implement feature X, update tests, and explain the changes."
									/>
								</div>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
										<Checkbox
											checked={shouldCommit}
											onCheckedChange={(checked) =>
												setShouldCommit(Boolean(checked))
											}
										/>
										Create commit inside the sandbox repo
									</label>
									<div className="flex items-center gap-2">
										{isSubmitting && (
											<Button
												variant="secondary"
												icon={<Square className="h-4 w-4" />}
												onClick={handleCancelRun}
											>
												Stop stream
											</Button>
										)}
										<Button
											variant="primary"
											icon={
												isSubmitting ? (
													<LoaderCircle className="h-4 w-4 animate-spin" />
												) : (
													<Play className="h-4 w-4" />
												)
											}
											onClick={handleRunTask}
											disabled={!canSubmit}
										>
											{isSubmitting ? "Running..." : "Run task"}
										</Button>
									</div>
								</div>
								{repo.trim() && !REPO_PATTERN.test(repo.trim()) && (
									<p className="text-xs text-red-600 dark:text-red-400">
										Repository must use owner/repo format.
									</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Conversation</CardTitle>
								<CardDescription>
									Request and outcome messages for this browser session.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{messages.length === 0 ? (
									<div className="text-sm text-muted-foreground">
										No messages yet. Submit a task to start.
									</div>
								) : (
									<div className="space-y-3">
										{messages.map((message) => (
											<div
												key={message.id}
												className={cn(
													"rounded-lg border p-3 text-sm",
													message.role === "user"
														? "bg-blue-600/5 border-blue-600/20"
														: "bg-card",
												)}
											>
												<div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
													<span className="font-medium uppercase tracking-wide">
														{message.role}
													</span>
													<span>{formatRelativeTime(message.createdAt)}</span>
												</div>
												<p className="whitespace-pre-wrap break-words">
													{message.content}
												</p>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Live stream</CardTitle>
								<CardDescription>
									Command-level progress events from the worker stream.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{timeline.length === 0 ? (
									<div className="text-sm text-muted-foreground">
										Waiting for events...
									</div>
								) : (
									<div className="space-y-2">
										{timeline.map((entry) => (
											<div
												key={entry.id}
												className="rounded-md border border-zinc-200/80 p-2 text-xs dark:border-zinc-700/70"
											>
												<div className="flex items-center justify-between gap-2">
													<span className="font-medium">
														{entry.event.type}
													</span>
													<span className="text-muted-foreground">
														{formatRelativeTime(entry.receivedAt)}
													</span>
												</div>
												<p className="mt-1 text-muted-foreground break-words">
													{describeEvent(entry.event)}
												</p>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Run history</CardTitle>
								<CardDescription>
									Recent executions for this installation.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isRunsLoading ? (
									<div className="text-sm text-muted-foreground">
										Loading runs...
									</div>
								) : runsError ? (
									<Alert variant="destructive">
										<AlertTitle>Unable to load run history</AlertTitle>
										<AlertDescription>
											{runsError instanceof Error
												? runsError.message
												: "Unknown error"}
										</AlertDescription>
									</Alert>
								) : runs.length === 0 ? (
									<div className="text-sm text-muted-foreground">
										No runs yet for this connection.
									</div>
								) : (
									<div className="space-y-2">
										{runs.map((run) => (
											<button
												type="button"
												key={run.runId}
												onClick={() => setSelectedRunId(run.runId)}
												className={cn(
													"w-full rounded-md border p-3 text-left transition",
													"hover:border-blue-500/60",
													selectedRunId === run.runId &&
														"border-blue-500 bg-blue-500/5",
												)}
											>
												<div className="flex items-center justify-between gap-2">
													<div className="truncate text-sm font-medium">
														{run.repo}
													</div>
													<Badge variant={statusBadgeVariant[run.status]}>
														{run.status}
													</Badge>
												</div>
												<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
													{run.task}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{formatRelativeTime(run.updatedAt)}
												</p>
											</button>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Selected run details</CardTitle>
								<CardDescription>
									Review summary, branch, and output from the selected run.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{selectedRun ? (
									<div className="space-y-3 text-sm">
										<div className="flex items-center justify-between gap-2">
											<Badge variant={statusBadgeVariant[selectedRun.status]}>
												{selectedRun.status}
											</Badge>
											<span className="text-xs text-muted-foreground">
												Run {selectedRun.runId}
											</span>
										</div>
										<p className="text-muted-foreground">
											{summariseRunResult(selectedRun)}
										</p>
										{typeof selectedRun.result?.branchName === "string" && (
											<p>
												<span className="font-medium">Branch:</span>{" "}
												{selectedRun.result.branchName}
											</p>
										)}
										{typeof selectedRun.result?.diff === "string" &&
											selectedRun.result.diff.trim() && (
												<div>
													<p className="mb-1 flex items-center gap-2 font-medium">
														<TerminalSquare className="h-4 w-4" />
														Diff
													</p>
													<pre className="max-h-56 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
														{selectedRun.result.diff}
													</pre>
												</div>
											)}
										{typeof selectedRun.result?.logs === "string" &&
											selectedRun.result.logs.trim() && (
												<div>
													<p className="mb-1 flex items-center gap-2 font-medium">
														<CheckCircle2 className="h-4 w-4" />
														Logs
													</p>
													<pre className="max-h-56 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
														{selectedRun.result.logs}
													</pre>
												</div>
											)}
									</div>
								) : (
									<div className="text-sm text-muted-foreground">
										Choose a run to inspect detailed output.
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</PageShell>
	);
}

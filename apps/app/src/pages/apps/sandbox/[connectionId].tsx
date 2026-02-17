import { useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	Copy,
	LoaderCircle,
	Play,
	Square,
	TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
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
	useSandboxRun,
	useSandboxRuns,
} from "~/hooks/useSandbox";
import { useAuthStatus } from "~/hooks/useAuth";
import { formatRelativeTime } from "~/lib/dates";
import { streamSandboxRun } from "~/lib/api/sandbox";
import { cn } from "~/lib/utils";
import type { SandboxRun, SandboxRunEvent } from "~/types/sandbox";
import {
	REPO_PATTERN,
	REPO_STORAGE_PREFIX,
	getStatusBadgeVariant,
	describeEvent,
} from "./utils";

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

async function copyToClipboard(text: string, label: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	} catch {
		toast.error("Failed to copy to clipboard");
	}
}

function normaliseRepoInput(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}

	if (REPO_PATTERN.test(trimmed)) {
		return trimmed;
	}

	try {
		const parsedUrl = new URL(trimmed);
		if (parsedUrl.hostname !== "github.com") {
			return trimmed;
		}

		const pathParts = parsedUrl.pathname
			.split("/")
			.map((part) => part.trim())
			.filter(Boolean);
		if (pathParts.length < 2) {
			return trimmed;
		}

		const owner = pathParts[0];
		const repo = pathParts[1].replace(/\.git$/i, "");
		const candidate = `${owner}/${repo}`;
		return REPO_PATTERN.test(candidate) ? candidate : trimmed;
	} catch {
		return trimmed;
	}
}

function buildTimelineFromRun(run: SandboxRun): TimelineEvent[] {
	return run.events.map((event, index) => ({
		id: `${run.runId}-event-${index}`,
		receivedAt:
			typeof event.timestamp === "string" ? event.timestamp : run.updatedAt,
		event,
	}));
}

function buildMessagesFromRun(run: SandboxRun): ChatMessage[] {
	const messages: ChatMessage[] = [
		{
			id: `${run.runId}-user`,
			role: "user",
			content: run.task,
			createdAt: run.startedAt,
		},
	];

	if (run.status === "completed" || run.status === "failed") {
		messages.push({
			id: `${run.runId}-assistant`,
			role: "assistant",
			content: summariseRunResult(run),
			createdAt: run.completedAt ?? run.updatedAt,
		});
	}

	return messages;
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
	const [searchParams, setSearchParams] = useSearchParams();
	const queryClient = useQueryClient();
	const { userSettings } = useAuthStatus();
	const abortControllerRef = useRef<AbortController | null>(null);
	const activeRunIdRef = useRef<string | undefined>(undefined);
	const searchParamsRef = useRef(searchParams);
	const hydratedSnapshotRef = useRef<string | undefined>(undefined);

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
	const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const timelineEndRef = useRef<HTMLDivElement>(null);

	const commandProgress = useMemo(() => {
		const commandEvents = timeline.filter(
			(entry) =>
				entry.event.type === "command_started" ||
				entry.event.type === "command_batch_ready",
		);
		const batchEvent = commandEvents.find(
			(entry) => entry.event.type === "command_batch_ready",
		);
		const lastCommandEvent = commandEvents
			.filter((entry) => entry.event.type === "command_started")
			.pop();

		if (!batchEvent || !lastCommandEvent) {
			return null;
		}

		const total = batchEvent.event.commandTotal;
		const current = lastCommandEvent.event.commandIndex;

		if (typeof total === "number" && typeof current === "number" && total > 0) {
			return { current, total };
		}

		return null;
	}, [timeline]);

	useEffect(() => {
		searchParamsRef.current = searchParams;
	}, [searchParams]);

	const connection = useMemo(
		() =>
			connections.find(
				(item) =>
					hasValidInstallationId && item.installationId === installationId,
			),
		[connections, hasValidInstallationId, installationId],
	);

	const repoSuggestions = useMemo(() => {
		const scopedRepos = connection?.repositories ?? [];
		const historyRepos = runs.map((run) => run.repo);
		const unique = new Set<string>();
		for (const entry of [...scopedRepos, ...historyRepos]) {
			const normalized = normaliseRepoInput(entry);
			if (REPO_PATTERN.test(normalized)) {
				unique.add(normalized);
			}
		}
		return Array.from(unique);
	}, [connection?.repositories, runs]);

	const normalisedRepo = useMemo(() => normaliseRepoInput(repo), [repo]);
	const selectedRunId = searchParams.get("runId") || undefined;
	const targetRunId = selectedRunId || activeRunId || runs[0]?.runId;
	const repoStorageKey = hasValidInstallationId
		? `${REPO_STORAGE_PREFIX}:${installationId}`
		: undefined;

	useEffect(() => {
		const configuredModel = userSettings?.sandbox_model?.trim();
		if (model.trim() || !configuredModel) {
			return;
		}
		setModel(configuredModel);
	}, [model, userSettings?.sandbox_model]);

	useEffect(() => {
		if (repo.trim()) {
			return;
		}
		if (repoStorageKey) {
			const storedRepo = window.localStorage.getItem(repoStorageKey);
			if (storedRepo) {
				setRepo(storedRepo);
				return;
			}
		}
		if (repoSuggestions.length > 0) {
			setRepo(repoSuggestions[0]);
		}
	}, [repo, repoStorageKey, repoSuggestions]);

	useEffect(() => {
		if (!repoStorageKey || !REPO_PATTERN.test(normalisedRepo)) {
			return;
		}
		window.localStorage.setItem(repoStorageKey, normalisedRepo);
	}, [repoStorageKey, normalisedRepo]);

	const selectedRunFromHistory = useMemo(() => {
		if (!targetRunId) {
			return undefined;
		}
		return runs.find((run) => run.runId === targetRunId);
	}, [runs, targetRunId]);

	const {
		data: selectedRunDetails,
		isLoading: isSelectedRunLoading,
		error: selectedRunError,
	} = useSandboxRun(targetRunId);

	const selectedRun = selectedRunDetails ?? selectedRunFromHistory;

	useEffect(() => {
		if (!selectedRun || isSubmitting) {
			return;
		}

		const snapshotKey = `${selectedRun.runId}:${selectedRun.updatedAt}:${selectedRun.status}`;
		if (hydratedSnapshotRef.current === snapshotKey) {
			return;
		}

		setTimeline(buildTimelineFromRun(selectedRun));
		setMessages(buildMessagesFromRun(selectedRun));
		hydratedSnapshotRef.current = snapshotKey;
	}, [isSubmitting, selectedRun]);

	useEffect(() => {
		if (isSubmitting && timeline.length > 0) {
			timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [isSubmitting, timeline.length]);

	const canSubmit = useMemo(() => {
		return (
			!isSubmitting &&
			Boolean(task.trim()) &&
			Boolean(normalisedRepo) &&
			REPO_PATTERN.test(normalisedRepo)
		);
	}, [isSubmitting, normalisedRepo, task]);

	const setSelectedRunInUrl = (runId?: string, replace = false) => {
		const next = new URLSearchParams(searchParamsRef.current);
		if (runId) {
			next.set("runId", runId);
		} else {
			next.delete("runId");
		}
		setSearchParams(next, { replace });
	};

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
		const trimmedRepo = normalisedRepo;
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
		hydratedSnapshotRef.current = undefined;
		setActiveRunId(undefined);
		activeRunIdRef.current = undefined;
		setSelectedRunInUrl(undefined, true);
		setRepo(trimmedRepo);
		setTimeline([]);
		setMessages([
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
								setSelectedRunInUrl(event.runId, true);
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
							setSelectedRunInUrl(finalEvent.runId, true);
						} else if (activeRunIdRef.current) {
							setSelectedRunInUrl(activeRunIdRef.current, true);
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
											onBlur={() => setRepo(normaliseRepoInput(repo))}
											placeholder="owner/repo"
										/>
										<datalist id="sandbox-repo-options">
											{repoSuggestions.map((repository) => (
												<option key={repository} value={repository} />
											))}
										</datalist>
										{repo.trim() && !REPO_PATTERN.test(normalisedRepo) ? (
											<p className="text-xs text-red-600 dark:text-red-400">
												Repository must use owner/repo format (or a GitHub URL).
											</p>
										) : repoSuggestions.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												No repo suggestions yet. Paste owner/repo or a GitHub
												repo URL and we will remember it for this installation.
											</p>
										) : null}
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
										<p className="text-xs text-muted-foreground">
											Leave blank to use your Sandbox model setting. If none is
											set, backend defaults to <code>mistral-large</code>.
										</p>
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
								{isSubmitting && commandProgress && (
									<div className="rounded-md border border-blue-200/80 bg-blue-50/50 p-3 dark:border-blue-800/50 dark:bg-blue-950/20">
										<div className="mb-2 flex items-center justify-between text-xs">
											<span className="font-medium text-blue-900 dark:text-blue-100">
												Executing commands
											</span>
											<span className="text-blue-700 dark:text-blue-300">
												{commandProgress.current} / {commandProgress.total}
											</span>
										</div>
										<div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/50 dark:bg-blue-900/30">
											<div
												className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
												style={{
													width: `${(commandProgress.current / commandProgress.total) * 100}%`,
												}}
											/>
										</div>
									</div>
								)}
								<div className="flex flex-wrap items-center justify-between gap-3">
									<label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
										<Checkbox
											checked={shouldCommit}
											onCheckedChange={(checked) =>
												setShouldCommit(Boolean(checked))
											}
										/>
										Automatically commit changes to a new branch when the run
										completes
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
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Conversation</CardTitle>
								<CardDescription>
									Request and outcome messages for the selected run.
								</CardDescription>
							</CardHeader>
							<CardContent className="max-h-96 overflow-auto">
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
								<div className="flex items-center justify-between gap-2">
									<CardTitle>Live stream</CardTitle>
									{isSubmitting && (
										<Badge variant="secondary" className="gap-1">
											<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
											Live
										</Badge>
									)}
									{!isSubmitting && selectedRun && (
										<Badge variant="outline" className="text-xs">
											Historical
										</Badge>
									)}
								</div>
								<CardDescription>
									{isSubmitting
										? "Real-time events from the current execution"
										: "Command-level events from selected run history"}
								</CardDescription>
							</CardHeader>
							<CardContent className="max-h-96 overflow-auto">
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
										<div ref={timelineEndRef} />
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Selected run details</CardTitle>
								<CardDescription>
									Review summary, branch, and output from the selected run.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isSelectedRunLoading && targetRunId ? (
									<div className="text-sm text-muted-foreground">
										Loading run details...
									</div>
								) : selectedRunError ? (
									<Alert variant="destructive">
										<AlertTitle>Unable to load selected run</AlertTitle>
										<AlertDescription>
											{selectedRunError instanceof Error
												? selectedRunError.message
												: "Unknown error"}
										</AlertDescription>
									</Alert>
								) : selectedRun ? (
									<div className="space-y-3 text-sm">
										<div className="flex items-center justify-between gap-2">
											<Badge
												variant={getStatusBadgeVariant(selectedRun.status)}
											>
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
													<div className="mb-1 flex items-center justify-between gap-2">
														<p className="flex items-center gap-2 font-medium">
															<TerminalSquare className="h-4 w-4" />
															Diff
														</p>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 gap-1 text-xs"
															onClick={() =>
																copyToClipboard(
																	selectedRun.result?.diff as string,
																	"Diff",
																)
															}
														>
															<Copy className="h-3 w-3" />
															Copy
														</Button>
													</div>
													<pre className="max-h-56 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
														{selectedRun.result.diff}
													</pre>
												</div>
											)}
										{typeof selectedRun.result?.logs === "string" &&
											selectedRun.result.logs.trim() && (
												<div>
													<div className="mb-1 flex items-center justify-between gap-2">
														<p className="flex items-center gap-2 font-medium">
															<CheckCircle2 className="h-4 w-4" />
															Logs
														</p>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 gap-1 text-xs"
															onClick={() =>
																copyToClipboard(
																	selectedRun.result?.logs as string,
																	"Logs",
																)
															}
														>
															<Copy className="h-3 w-3" />
															Copy
														</Button>
													</div>
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

						<Card>
							<CardHeader>
								<CardTitle>Run history</CardTitle>
								<CardDescription>
									Recent executions for this installation.
								</CardDescription>
							</CardHeader>
							<CardContent className="max-h-[400px] overflow-auto">
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
												onClick={() => setSelectedRunInUrl(run.runId)}
												className={cn(
													"w-full rounded-md border p-3 text-left transition",
													"hover:border-blue-500/60",
													targetRunId === run.runId &&
														"border-blue-500 bg-blue-500/5",
												)}
											>
												<div className="flex items-center justify-between gap-2">
													<div className="truncate text-sm font-medium">
														{run.repo}
													</div>
													<Badge variant={getStatusBadgeVariant(run.status)}>
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
					</div>
				</div>
			)}
		</PageShell>
	);
}

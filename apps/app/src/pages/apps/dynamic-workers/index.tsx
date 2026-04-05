import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	FormSelect,
	Input,
	Label,
	Textarea,
} from "~/components/ui";
import {
	cancelDynamicWorkerRun,
	fetchDynamicWorkerRuns,
	streamDynamicWorkerRun,
} from "~/lib/api/dynamic-workers";
import { formatRelativeTime } from "~/lib/dates";
import {
	DYNAMIC_WORKER_CAPABILITIES,
	type DynamicWorkerCapability,
	type DynamicWorkerRun,
	type DynamicWorkerRunEvent,
	type ExecuteDynamicWorkerRunPayload,
} from "~/types/dynamic-workers";

export function meta() {
	return [
		{ title: "Dynamic Workers - Polychat" },
		{
			name: "description",
			content:
				"Run capability-scoped dynamic worker tasks with streamed execution output.",
		},
	];
}

const DEFAULT_TIMEOUT_SECONDS = 120;

export default function DynamicWorkersPage() {
	const [task, setTask] = useState("");
	const [code, setCode] = useState("");
	const [model, setModel] = useState("");
	const [timeoutSeconds, setTimeoutSeconds] = useState(DEFAULT_TIMEOUT_SECONDS);
	const [trustLevel, setTrustLevel] =
		useState<ExecuteDynamicWorkerRunPayload["trustLevel"]>("balanced");
	const [enabledCapabilities, setEnabledCapabilities] = useState<
		DynamicWorkerCapability[]
	>(["echo", "clock"]);
	const [events, setEvents] = useState<DynamicWorkerRunEvent[]>([]);
	const [runs, setRuns] = useState<DynamicWorkerRun[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoadingRuns, setIsLoadingRuns] = useState(false);
	const [activeRunId, setActiveRunId] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const loadRuns = useCallback(async () => {
		setIsLoadingRuns(true);
		try {
			const nextRuns = await fetchDynamicWorkerRuns({ limit: 15 });
			setRuns(nextRuns);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to load dynamic worker runs",
			);
		} finally {
			setIsLoadingRuns(false);
		}
	}, []);

	useEffect(() => {
		void loadRuns();
	}, [loadRuns]);

	const canSubmit = useMemo(
		() => task.trim().length > 0 && !isSubmitting,
		[task, isSubmitting],
	);

	const onToggleCapability = (capability: DynamicWorkerCapability) => {
		setEnabledCapabilities((current) =>
			current.includes(capability)
				? current.filter((entry) => entry !== capability)
				: [...current, capability],
		);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!task.trim()) {
			toast.error("Task is required");
			return;
		}

		setIsSubmitting(true);
		setEvents([]);
		const abortController = new AbortController();
		abortRef.current = abortController;
		let terminalEvent: DynamicWorkerRunEvent | undefined;

		try {
			await streamDynamicWorkerRun(
				{
					task: task.trim(),
					code: code.trim() || undefined,
					model: model.trim() || undefined,
					timeoutSeconds,
					trustLevel,
					capabilities: enabledCapabilities,
				},
				{
					signal: abortController.signal,
					onRunStarted: (runId) => {
						setActiveRunId(runId);
					},
					onEvent: (nextEvent) => {
						setEvents((current) => [...current, nextEvent]);
					},
					onComplete: (finalEvent) => {
						terminalEvent = finalEvent;
						setIsSubmitting(false);
						setActiveRunId(null);
					},
				},
			);
			if (terminalEvent?.type === "run_failed") {
				toast.error(terminalEvent.error || "Dynamic worker run failed");
			} else if (terminalEvent?.type === "run_cancelled") {
				toast.error(terminalEvent.message || "Dynamic worker run cancelled");
			} else {
				toast.success("Dynamic worker run completed");
			}
			await loadRuns();
		} catch (error) {
			setIsSubmitting(false);
			setActiveRunId(null);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to execute dynamic worker run",
			);
		}
	};

	const handleCancel = async () => {
		abortRef.current?.abort();
		if (!activeRunId) {
			setIsSubmitting(false);
			return;
		}

		try {
			await cancelDynamicWorkerRun(activeRunId);
			toast.success("Cancellation requested");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to cancel dynamic worker run",
			);
		}
		setIsSubmitting(false);
		setActiveRunId(null);
	};

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
		>
			<PageHeader>
				<BackLink to="/apps" label="Back to Apps" />
				<PageTitle title="Dynamic Workers" />
				<p className="text-sm text-muted-foreground max-w-3xl">
					Run short-lived isolated tasks with dynamic workers and
					capability-based bindings.
				</p>
			</PageHeader>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Run Task</CardTitle>
						<CardDescription>
							Submit a task and optional JavaScript module source for execution.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleSubmit}>
							<div className="space-y-2">
								<Label htmlFor="dynamic-task">Task</Label>
								<Textarea
									id="dynamic-task"
									value={task}
									onChange={(e) => setTask(e.target.value)}
									placeholder="Describe the task to execute"
									rows={4}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="dynamic-code">Module Code (optional)</Label>
								<Textarea
									id="dynamic-code"
									value={code}
									onChange={(e) => setCode(e.target.value)}
									placeholder="export default { async fetch(request, env) { ... } }"
									rows={8}
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="dynamic-model">Model (optional)</Label>
									<Input
										id="dynamic-model"
										value={model}
										onChange={(e) => setModel(e.target.value)}
										placeholder="mistral-large"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="dynamic-timeout">Timeout (seconds)</Label>
									<Input
										id="dynamic-timeout"
										type="number"
										min={30}
										max={7200}
										value={timeoutSeconds}
										onChange={(e) => {
											const value = Number(e.target.value);
											if (Number.isFinite(value)) {
												setTimeoutSeconds(value);
											}
										}}
									/>
								</div>
								<div className="space-y-2">
									<FormSelect
										id="dynamic-trust-level"
										label="Trust level"
										value={trustLevel ?? "balanced"}
										onChange={(event) =>
											setTrustLevel(
												event.target
													.value as ExecuteDynamicWorkerRunPayload["trustLevel"],
											)
										}
										options={[
											{ value: "strict", label: "Strict" },
											{ value: "balanced", label: "Balanced" },
											{ value: "trusted", label: "Trusted" },
										]}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Capabilities</Label>
								<div className="flex flex-wrap gap-2">
									{DYNAMIC_WORKER_CAPABILITIES.map((capability) => {
										const active = enabledCapabilities.includes(capability);
										return (
											<button
												key={capability}
												type="button"
												onClick={() => onToggleCapability(capability)}
												className={`px-3 py-1.5 rounded-md border text-sm ${
													active
														? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
														: "border-zinc-300 dark:border-zinc-700"
												}`}
											>
												{capability}
											</button>
										);
									})}
								</div>
							</div>

							<div className="flex gap-3">
								<Button type="submit" variant="primary" disabled={!canSubmit}>
									{isSubmitting ? "Running..." : "Run"}
								</Button>
								<Button
									type="button"
									variant="secondary"
									onClick={handleCancel}
									disabled={!isSubmitting}
								>
									Cancel
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Live Events</CardTitle>
						<CardDescription>
							Streaming run events from the current dynamic worker execution.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2 max-h-[520px] overflow-y-auto">
							{events.length === 0 ? (
								<p className="text-sm text-muted-foreground">No events yet.</p>
							) : (
								events.map((event, index) => (
									<div
										key={`${event.type}-${event.timestamp ?? index}-${index}`}
										className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3"
									>
										<div className="flex items-center justify-between gap-2">
											<Badge variant="secondary">{event.type}</Badge>
											<span className="text-xs text-muted-foreground">
												{event.timestamp
													? formatRelativeTime(event.timestamp)
													: "now"}
											</span>
										</div>
										{event.message ? (
											<p className="text-sm mt-2">{event.message}</p>
										) : null}
										{event.error ? (
											<p className="text-sm mt-2 text-red-600 dark:text-red-400">
												{event.error}
											</p>
										) : null}
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card className="mt-6">
				<CardHeader>
					<CardTitle>Recent Runs</CardTitle>
					<CardDescription>
						{isLoadingRuns ? "Loading runs..." : "Stored dynamic worker runs"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{runs.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No dynamic worker runs yet.
							</p>
						) : (
							runs.map((run) => (
								<div
									key={run.runId}
									className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3"
								>
									<div className="flex flex-wrap items-center gap-2 justify-between">
										<div className="flex items-center gap-2">
											<Badge variant="secondary">{run.status}</Badge>
											<span className="text-xs text-muted-foreground">
												{formatRelativeTime(run.updatedAt)}
											</span>
										</div>
										<span className="text-xs text-muted-foreground">
											{run.runId}
										</span>
									</div>
									<p className="text-sm mt-2 line-clamp-2">{run.task}</p>
								</div>
							))
						)}
					</div>
				</CardContent>
			</Card>
		</PageShell>
	);
}

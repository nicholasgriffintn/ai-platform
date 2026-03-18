import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
	SANDBOX_QUERY_KEYS,
	useCancelSandboxRun,
	usePauseSandboxRun,
	useResumeSandboxRun,
	useSubmitSandboxRunInstruction,
	useSandboxConnections,
	useSandboxRun,
	useSandboxRunInstructions,
	useSandboxRuns,
} from "~/hooks/useSandbox";
import { useAuthStatus } from "~/hooks/useAuth";
import { streamSandboxRun, streamSandboxRunEvents } from "~/lib/api/sandbox";
import { normaliseGitHubRepoInput } from "~/lib/sandbox/repositories";
import {
	SANDBOX_TIMEOUT_DEFAULT_SECONDS,
	SANDBOX_TIMEOUT_MAX_SECONDS,
	SANDBOX_TIMEOUT_MIN_SECONDS,
	type SandboxPromptStrategy,
	type SandboxRun,
	type SandboxRunEvent,
	type SandboxTaskType,
} from "~/types/sandbox";
import { REPO_PATTERN, REPO_STORAGE_PREFIX } from "../utils";
import {
	buildMessagesFromRun,
	buildTimelineFromRun,
	extractPlanTasks,
	getAssistantMessageFromEvent,
	getLatestPlanEvent,
	isApprovalPendingStatus,
	isRunStatusActive,
	toApprovalInstructionItems,
} from "./helpers";
import type {
	ApprovalInstructionItem,
	ChatMessage,
	TimelineEvent,
} from "./types";

export function useSandboxRunConsole() {
	const params = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const queryClient = useQueryClient();
	const { userSettings } = useAuthStatus();

	const abortControllerRef = useRef<AbortController | null>(null);
	const runEventsAbortControllerRef = useRef<AbortController | null>(null);
	const runEventOffsetRef = useRef<Map<string, number>>(new Map());
	const activeRunIdRef = useRef<string | undefined>(undefined);
	const searchParamsRef = useRef(searchParams);
	const hydratedRunIdRef = useRef<string | undefined>(undefined);
	const timelineEndRef = useRef<HTMLDivElement>(null);

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
		{ enabled: hasValidInstallationId },
	);
	const cancelRunMutation = useCancelSandboxRun();
	const pauseRunMutation = usePauseSandboxRun();
	const resumeRunMutation = useResumeSandboxRun();
	const submitInstructionMutation = useSubmitSandboxRunInstruction();

	const [repo, setRepo] = useState("");
	const [task, setTask] = useState("");
	const [model, setModel] = useState("");
	const [taskType, setTaskType] = useState<SandboxTaskType>(
		"feature-implementation",
	);
	const [promptStrategy, setPromptStrategy] =
		useState<SandboxPromptStrategy>("auto");
	const [timeoutSecondsInput, setTimeoutSecondsInput] = useState(
		String(SANDBOX_TIMEOUT_DEFAULT_SECONDS),
	);
	const [shouldCommit, setShouldCommit] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [activeRunId, setActiveRunId] = useState<string | undefined>();
	const [liveRunStatus, setLiveRunStatus] = useState<
		"running" | "paused" | undefined
	>(undefined);
	const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [operatorMessage, setOperatorMessage] = useState("");

	const isReadOnlyTaskType =
		taskType === "code-review" || taskType === "test-suite";

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

		if (!batchEvent || !lastCommandEvent) return null;

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
			const normalized = normaliseGitHubRepoInput(entry);
			if (REPO_PATTERN.test(normalized)) unique.add(normalized);
		}
		return Array.from(unique);
	}, [connection?.repositories, runs]);

	const normalisedRepo = useMemo(() => normaliseGitHubRepoInput(repo), [repo]);

	const parsedTimeoutSeconds = useMemo(() => {
		const raw = timeoutSecondsInput.trim();
		if (!raw) return undefined;
		const parsed = Number.parseInt(raw, 10);
		return Number.isFinite(parsed) ? parsed : Number.NaN;
	}, [timeoutSecondsInput]);

	const hasValidTimeout =
		parsedTimeoutSeconds === undefined ||
		(Number.isFinite(parsedTimeoutSeconds) &&
			parsedTimeoutSeconds >= SANDBOX_TIMEOUT_MIN_SECONDS &&
			parsedTimeoutSeconds <= SANDBOX_TIMEOUT_MAX_SECONDS);

	const selectedRunId = searchParams.get("runId") || undefined;
	const targetRunId = selectedRunId || activeRunId || runs[0]?.runId;
	const approvalsRunId = activeRunId || targetRunId;

	const selectedRunFromHistory = useMemo(
		() =>
			targetRunId ? runs.find((run) => run.runId === targetRunId) : undefined,
		[runs, targetRunId],
	);

	const {
		data: selectedRunDetails,
		isLoading: isSelectedRunLoading,
		error: selectedRunError,
	} = useSandboxRun(targetRunId);

	const {
		data: runInstructions = [],
		isLoading: isInstructionsLoading,
		error: instructionsError,
	} = useSandboxRunInstructions(approvalsRunId, {
		enabled: Boolean(approvalsRunId),
	});

	const approvals = useMemo(
		() =>
			toApprovalInstructionItems(runInstructions).sort(
				(a, b) =>
					new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
			),
		[runInstructions],
	);

	const pendingApprovals = useMemo(
		() =>
			approvals
				.filter((a) => isApprovalPendingStatus(a.status))
				.sort(
					(a, b) =>
						new Date(a.requestedAt).getTime() -
						new Date(b.requestedAt).getTime(),
				),
		[approvals],
	);

	const repoStorageKey = hasValidInstallationId
		? `${REPO_STORAGE_PREFIX}:${installationId}`
		: undefined;

	useEffect(() => {
		const configuredModel = userSettings?.sandbox_model?.trim();
		if (model.trim() || !configuredModel) return;
		setModel(configuredModel);
	}, [model, userSettings?.sandbox_model]);

	useEffect(() => {
		if (repo.trim()) return;
		if (repoStorageKey) {
			const storedRepo = window.localStorage.getItem(repoStorageKey);
			if (storedRepo) {
				setRepo(storedRepo);
				return;
			}
		}
		if (repoSuggestions.length > 0) setRepo(repoSuggestions[0]);
	}, [repo, repoStorageKey, repoSuggestions]);

	useEffect(() => {
		if (!repoStorageKey || !REPO_PATTERN.test(normalisedRepo)) return;
		window.localStorage.setItem(repoStorageKey, normalisedRepo);
	}, [repoStorageKey, normalisedRepo]);

	useEffect(() => {
		if (isReadOnlyTaskType && shouldCommit) setShouldCommit(false);
	}, [isReadOnlyTaskType, shouldCommit]);

	const selectedRun = selectedRunDetails ?? selectedRunFromHistory;
	const latestPlan = useMemo(() => getLatestPlanEvent(timeline), [timeline]);
	const planTasks = useMemo(
		() => (latestPlan ? extractPlanTasks(latestPlan.plan) : []),
		[latestPlan],
	);

	const instructionRunId = useMemo(() => {
		const run = selectedRunDetails ?? selectedRunFromHistory;
		if (activeRunId) return activeRunId;
		if (!run) return undefined;
		return isRunStatusActive(run.status) || run.status === "paused"
			? run.runId
			: undefined;
	}, [activeRunId, selectedRunDetails, selectedRunFromHistory]);

	const shouldSubscribeToRunEvents =
		!isSubmitting &&
		Boolean(targetRunId) &&
		(isRunStatusActive(selectedRun?.status) || pendingApprovals.length > 0);

	useEffect(() => {
		if (!targetRunId || !shouldSubscribeToRunEvents) return;

		runEventsAbortControllerRef.current?.abort();
		const controller = new AbortController();
		runEventsAbortControllerRef.current = controller;
		const knownEventCount =
			runEventOffsetRef.current.get(targetRunId) ??
			selectedRun?.events?.length ??
			0;

		void streamSandboxRunEvents(targetRunId, {
			signal: controller.signal,
			after: knownEventCount,
			onEvent: (event) => {
				const receivedAt = new Date().toISOString();
				runEventOffsetRef.current.set(
					targetRunId,
					(runEventOffsetRef.current.get(targetRunId) ?? knownEventCount) + 1,
				);
				const eventId = crypto.randomUUID();
				setTimeline((prev) => {
					const next = [...prev, { id: eventId, receivedAt, event }];
					return next.length > 300 ? next.slice(next.length - 300) : next;
				});
				const assistantMessage = getAssistantMessageFromEvent(event);
				if (assistantMessage)
					pushAssistantMessage(assistantMessage, receivedAt);

				queryClient.setQueryData<SandboxRun | undefined>(
					SANDBOX_QUERY_KEYS.run(targetRunId),
					(current) => {
						if (!current) return current;
						let nextStatus = current.status;
						if (event.type === "run_completed") nextStatus = "completed";
						else if (event.type === "run_failed") nextStatus = "failed";
						else if (event.type === "run_cancelled") nextStatus = "cancelled";
						else if (event.type === "run_paused") nextStatus = "paused";
						else if (event.type === "run_resumed") nextStatus = "running";

						return {
							...current,
							status: nextStatus,
							updatedAt: receivedAt,
							completedAt:
								nextStatus === "completed" ||
								nextStatus === "failed" ||
								nextStatus === "cancelled"
									? (event.completedAt ?? receivedAt)
									: current.completedAt,
							error: event.error ?? current.error,
							result: event.result ?? current.result,
							events: [...(current.events ?? []), event],
						};
					},
				);

				if (
					event.type === "command_approval_requested" ||
					event.type === "command_approval_escalated" ||
					event.type === "command_approval_timed_out" ||
					event.type === "command_approval_resolved"
				) {
					queryClient.invalidateQueries({
						queryKey: SANDBOX_QUERY_KEYS.runInstructions(targetRunId),
					});
				}
			},
			onComplete: () => {
				if (runEventsAbortControllerRef.current === controller) {
					runEventsAbortControllerRef.current = null;
				}
			},
		}).catch((err) => {
			if ((err as Error).name !== "AbortError") {
				console.error("Sandbox run events stream failed:", err);
			}
		});

		return () => {
			controller.abort();
			if (runEventsAbortControllerRef.current === controller) {
				runEventsAbortControllerRef.current = null;
			}
		};
	}, [
		pendingApprovals.length,
		queryClient,
		shouldSubscribeToRunEvents,
		targetRunId,
	]);

	useEffect(() => {
		if (!selectedRun || isSubmitting) return;

		const isSameRunHydrated =
			hydratedRunIdRef.current === selectedRun.runId && timeline.length > 0;
		const hasRicherServerSnapshot =
			selectedRunDetails?.runId === selectedRun.runId &&
			selectedRunDetails.events.length > timeline.length;
		if (isSameRunHydrated && !hasRicherServerSnapshot) return;

		setTimeline(buildTimelineFromRun(selectedRun));
		setMessages(buildMessagesFromRun(selectedRun));
		runEventOffsetRef.current.set(selectedRun.runId, selectedRun.events.length);
		hydratedRunIdRef.current = selectedRun.runId;
	}, [isSubmitting, selectedRun, selectedRunDetails, timeline.length]);

	useEffect(() => {
		if (isSubmitting && timeline.length > 0) {
			timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [isSubmitting, timeline.length]);

	const canSubmit = useMemo(
		() =>
			!isSubmitting &&
			Boolean(task.trim()) &&
			Boolean(normalisedRepo) &&
			REPO_PATTERN.test(normalisedRepo) &&
			hasValidTimeout,
		[hasValidTimeout, isSubmitting, normalisedRepo, task],
	);

	const pushAssistantMessage = (content: string, createdAt: string) => {
		setMessages((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: "assistant", content, createdAt },
		]);
	};

	const pushTimelineEvent = (event: SandboxRunEvent, receivedAt: string) => {
		const eventId = crypto.randomUUID();
		setTimeline((prev) => {
			const next = [...prev, { id: eventId, receivedAt, event }];
			return next.length > 300 ? next.slice(next.length - 300) : next;
		});
	};

	const setSelectedRunInUrl = (runId?: string, replace = false) => {
		const next = new URLSearchParams(searchParamsRef.current);
		if (runId) next.set("runId", runId);
		else next.delete("runId");
		setSearchParams(next, { replace });
	};

	const handleCancelRun = async () => {
		const controller = abortControllerRef.current;
		if (!controller) return;

		const runId = activeRunIdRef.current;
		if (runId) {
			try {
				await cancelRunMutation.mutateAsync({
					runId,
					reason: "Cancelled from Sandbox run console",
				});
				toast.success("Cancellation requested");
				setSelectedRunInUrl(runId, true);
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to cancel sandbox run",
				);
			}
		}

		controller.abort();
		abortControllerRef.current = null;
		setActiveRunId(undefined);
		activeRunIdRef.current = undefined;
		setIsSubmitting(false);
		setLiveRunStatus(undefined);
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: "assistant",
				content: runId
					? "Cancellation requested. Waiting for run status to update."
					: "Stream stopped before a run id was assigned.",
				createdAt: new Date().toISOString(),
			},
		]);
	};

	const handlePauseRun = async () => {
		const runId = activeRunIdRef.current;
		if (!runId) {
			toast.error("Run id is not available yet");
			return;
		}
		try {
			await pauseRunMutation.mutateAsync({
				runId,
				reason: "Paused from Sandbox run console",
			});
			setLiveRunStatus("paused");
			toast.success("Pause requested");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to pause sandbox run",
			);
		}
	};

	const handleResumeRun = async () => {
		const runId = activeRunIdRef.current;
		if (!runId) {
			toast.error("Run id is not available yet");
			return;
		}
		try {
			await resumeRunMutation.mutateAsync({
				runId,
				reason: "Resumed from Sandbox run console",
			});
			setLiveRunStatus("running");
			toast.success("Resume requested");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to resume sandbox run",
			);
		}
	};

	const handleResolveApproval = async (
		approval: ApprovalInstructionItem,
		status: "approved" | "rejected",
	) => {
		if (!approvalsRunId) {
			toast.error("Run id is not available yet");
			return;
		}
		try {
			await submitInstructionMutation.mutateAsync({
				runId: approvalsRunId,
				kind: "approval_response",
				requestId: approval.id,
				approvalStatus: status,
				content:
					status === "approved"
						? "Approved from Sandbox run console"
						: "Rejected from Sandbox run console",
			});
			toast.success(
				status === "approved" ? "Command approved" : "Command rejected",
			);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to submit command approval response",
			);
		}
	};

	const handleSubmitInstruction = async (kind: "message" | "continue") => {
		if (!instructionRunId) {
			toast.error("No active run available for instructions");
			return;
		}
		const content = operatorMessage.trim();
		if (kind === "message" && !content) {
			toast.error("Enter a message to send to the agent");
			return;
		}
		try {
			await submitInstructionMutation.mutateAsync({
				runId: instructionRunId,
				kind,
				content: content || undefined,
			});
			if (content) {
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "user",
						content,
						createdAt: new Date().toISOString(),
					},
				]);
			}
			setOperatorMessage("");
			toast.success(
				kind === "continue"
					? "Continue instruction sent"
					: "Message sent to run",
			);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to send instruction",
			);
		}
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
		if (!hasValidTimeout) {
			toast.error(
				`Timeout must be between ${SANDBOX_TIMEOUT_MIN_SECONDS} and ${SANDBOX_TIMEOUT_MAX_SECONDS} seconds`,
			);
			return;
		}
		if (!connection) {
			toast.error("Connection not found");
			return;
		}

		const controller = new AbortController();
		abortControllerRef.current = controller;
		setIsSubmitting(true);
		hydratedRunIdRef.current = undefined;
		setActiveRunId(undefined);
		activeRunIdRef.current = undefined;
		setLiveRunStatus("running");
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
					taskType,
					model: model.trim() || undefined,
					promptStrategy,
					shouldCommit: isReadOnlyTaskType ? false : shouldCommit,
					timeoutSeconds: parsedTimeoutSeconds,
				},
				{
					signal: controller.signal,
					onRunStarted: (runId) => {
						if (activeRunIdRef.current) return;
						activeRunIdRef.current = runId;
						setActiveRunId(runId);
						setSelectedRunInUrl(runId, true);
					},
					onEvent: (event) => {
						const receivedAt = new Date().toISOString();
						pushTimelineEvent(event, receivedAt);

						if (event.runId && !activeRunIdRef.current) {
							activeRunIdRef.current = event.runId;
							setActiveRunId(event.runId);
							setSelectedRunInUrl(event.runId, true);
						}

						if (
							event.type === "run_completed" ||
							event.type === "run_failed" ||
							event.type === "run_cancelled"
						) {
							setLiveRunStatus(undefined);
						} else if (event.type === "run_paused") {
							setLiveRunStatus("paused");
						} else if (event.type === "run_resumed") {
							setLiveRunStatus("running");
						}

						const assistantMessage = getAssistantMessageFromEvent(event);
						if (assistantMessage)
							pushAssistantMessage(assistantMessage, receivedAt);
					},
					onComplete: (finalEvent) => {
						setIsSubmitting(false);
						setLiveRunStatus(undefined);
						abortControllerRef.current = null;

						if (finalEvent?.runId) setSelectedRunInUrl(finalEvent.runId, true);
						else if (activeRunIdRef.current)
							setSelectedRunInUrl(activeRunIdRef.current, true);

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
				pushAssistantMessage(
					asError.message || "Failed to run sandbox task",
					new Date().toISOString(),
				);
			}
			setIsSubmitting(false);
			setLiveRunStatus(undefined);
			abortControllerRef.current = null;
			activeRunIdRef.current = undefined;
			queryClient.invalidateQueries({ queryKey: SANDBOX_QUERY_KEYS.root });
		}
	};

	return {
		// Page-level state
		installationId,
		hasValidInstallationId,
		// Connection data
		connection,
		isLoading,
		error,
		// Runs
		runs,
		isRunsLoading,
		runsError,
		selectedRun,
		isSelectedRunLoading,
		selectedRunError,
		targetRunId,
		// Approvals
		approvals,
		pendingApprovals,
		approvalsRunId,
		isInstructionsLoading,
		instructionsError,
		// Form state
		repo,
		setRepo,
		task,
		setTask,
		model,
		setModel,
		taskType,
		setTaskType,
		promptStrategy,
		setPromptStrategy,
		timeoutSecondsInput,
		setTimeoutSecondsInput,
		hasValidTimeout,
		shouldCommit,
		setShouldCommit,
		isReadOnlyTaskType,
		repoSuggestions,
		normalisedRepo,
		// Run state
		isSubmitting,
		canSubmit,
		liveRunStatus,
		activeRunId,
		commandProgress,
		// Timeline / messages
		timeline,
		messages,
		latestPlan,
		planTasks,
		timelineEndRef,
		// Operator input
		operatorMessage,
		setOperatorMessage,
		instructionRunId,
		// Mutation pending states
		isPausePending: pauseRunMutation.isPending,
		isResumePending: resumeRunMutation.isPending,
		isCancelPending: cancelRunMutation.isPending,
		isInstructionPending: submitInstructionMutation.isPending,
		// Handlers
		setSelectedRunInUrl,
		handleRunTask,
		handlePauseRun,
		handleResumeRun,
		handleCancelRun,
		handleResolveApproval,
		handleSubmitInstruction,
	};
}

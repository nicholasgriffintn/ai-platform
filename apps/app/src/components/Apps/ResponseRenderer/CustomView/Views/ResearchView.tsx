import { ExternalLink, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui";
import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { useResearchStatus } from "~/hooks/useResearchStatus";
import type { ResearchStatus } from "~/types/research";
import { JsonView } from "../../JsonView";

const providerLabels: Record<string, string> = {
	parallel: "Parallel",
};

const statusColors: Record<string, string> = {
	completed:
		"bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-500/40",
	running:
		"bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-500/40",
	queued:
		"bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-500/40",
	processing:
		"bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-500/40",
	failed:
		"bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
	cancelled:
		"bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
	errored:
		"bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
	stopped:
		"bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
};

const FAILURE_STATUSES = new Set(["failed", "cancelled", "errored", "stopped"]);

type AsyncInvocationData = {
	provider?: string;
	id?: string;
	poll?: {
		url?: string;
		method?: string;
	};
	pollIntervalMs?: number;
	status?: string;
};

const normalizeStatus = (status?: string) => status?.toLowerCase() ?? "";

const ensureInterval = (value?: number | null, fallback = 5000) => {
	const numeric =
		typeof value === "number" && Number.isFinite(value) ? value : fallback;
	return Math.max(1000, numeric);
};

const buildInitialStatus = (
	base: any,
	provider: string,
): ResearchStatus | undefined => {
	if (!base?.run) {
		return undefined;
	}

	return {
		provider,
		run: base.run,
		output: base.output ?? undefined,
		warnings: base.warnings ?? undefined,
		poll: base.poll ?? undefined,
	};
};

function extractHostname(url?: string | null) {
	if (!url) {
		return "";
	}
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, "");
	} catch (_error) {
		return url;
	}
}

export function ResearchView({
	data,
	embedded,
}: {
	data: any;
	embedded: boolean;
}) {
	const [showAllEvidence, setShowAllEvidence] = useState(false);

	if (!data) {
		return (
			<p className="text-red-500 dark:text-red-300">
				No research data available
			</p>
		);
	}

	const initialProvider = data.provider ?? data.raw?.provider ?? "parallel";
	const providerLabel = providerLabels[initialProvider] ?? initialProvider;
	const providerWarning = data.providerWarning ?? data.raw?.providerWarning;

	const asyncInvocation = (data.asyncInvocation ??
		data.data?.asyncInvocation) as AsyncInvocationData | undefined;

	const combinedInitial = {
		run: data.run ?? data.raw?.run ?? data.data?.run,
		output: data.output ?? data.raw?.output ?? data.data?.output,
		warnings: data.warnings ?? data.raw?.warnings ?? data.data?.warnings,
		poll: data.poll ?? data.raw?.poll ?? data.data?.poll,
	};

	const initialStatus = buildInitialStatus(combinedInitial, initialProvider);
	const initialRunId =
		initialStatus?.run?.run_id ??
		asyncInvocation?.id ??
		data.run_id ??
		data.data?.run_id ??
		null;

	const basePollInterval = ensureInterval(
		initialStatus?.poll?.interval_ms ??
			asyncInvocation?.pollIntervalMs ??
			data.options?.polling?.interval_ms ??
			data.poll?.interval_ms,
	);

	const initialStatusLabel = normalizeStatus(initialStatus?.run?.status);
	const isInitialFailure = FAILURE_STATUSES.has(initialStatusLabel);
	const isInitialCompleted = initialStatusLabel === "completed";
	const shouldPollInitially =
		Boolean(initialRunId) &&
		Boolean(initialStatus) &&
		(!initialStatus?.output || (!isInitialFailure && !isInitialCompleted));

	const researchQuery = useResearchStatus({
		runId: initialRunId ?? undefined,
		provider: initialProvider,
		enabled: shouldPollInitially,
		pollInterval: basePollInterval,
		initialData: initialStatus,
	});

	const statusData = (researchQuery.data ?? initialStatus) as
		| ResearchStatus
		| undefined;

	const run = statusData?.run;
	const runId = run?.run_id ?? initialRunId;
	const output = statusData?.output;
	const warnings = statusData?.warnings;
	const normalizedStatus = normalizeStatus(
		run?.status ?? asyncInvocation?.status,
	);
	const isFailure = FAILURE_STATUSES.has(normalizedStatus);
	const isInProgress =
		Boolean(runId) && !isFailure && normalizedStatus !== "completed";

	const evidence = Array.isArray(output?.basis) ? output?.basis : [];
	const displayedEvidence = useMemo(() => {
		if (showAllEvidence) {
			return evidence;
		}
		return evidence.slice(0, 4);
	}, [evidence, showAllEvidence]);

	const content = output?.content;
	const isTextContent = typeof content === "string";
	const evidenceCount = evidence.length;

	const lastUpdatedAt = researchQuery.dataUpdatedAt
		? new Date(researchQuery.dataUpdatedAt)
		: run?.modified_at
			? new Date(run.modified_at)
			: null;

	const queryError = researchQuery.error?.message;
	const runError = isFailure ? run?.error : undefined;
	const combinedError = queryError ?? runError ?? null;

	const shouldShowPollingNotice = isInProgress && !output;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
				<span className="rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-3 py-1">
					Provider: {providerLabel}
				</span>
				{run?.processor && (
					<span className="rounded-full bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 px-3 py-1">
						Processor: {run.processor}
					</span>
				)}
				{normalizedStatus && (
					<span
						className={`rounded-full px-3 py-1 ${
							statusColors[normalizedStatus] ??
							"bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-300 border border-zinc-500/30"
						}`}
					>
						Status: {normalizedStatus}
					</span>
				)}
				{lastUpdatedAt && (
					<span className="rounded-full bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-300 px-3 py-1">
						Updated {lastUpdatedAt.toLocaleTimeString()}
					</span>
				)}
			</div>

			{shouldShowPollingNotice && !combinedError && (
				<div className="flex items-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-600 dark:text-blue-300">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>Research in progress. We&apos;ll keep this view updated.</span>
				</div>
			)}

			{combinedError && (
				<div className="rounded-md border border-red-600/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
					{combinedError}
				</div>
			)}

			{Array.isArray(warnings) && warnings.length > 0 && (
				<div className="rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3 text-sm">
					{warnings.join(" ")}
				</div>
			)}

			{typeof warnings === "string" && warnings && (
				<div className="rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3 text-sm">
					{warnings}
				</div>
			)}

			{providerWarning && (
				<div className="rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3 text-sm">
					{providerWarning}
				</div>
			)}

			{output && (
				<>
					{isTextContent ? (
						<div className="prose dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-200">
							<MemoizedMarkdown>{content as string}</MemoizedMarkdown>
						</div>
					) : (
						<JsonView data={content ?? {}} />
					)}
				</>
			)}

			{output && evidenceCount > 0 && (
				<div>
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
							Evidence & Citations
						</h2>
						{evidenceCount > 4 && (
							<button
								type="button"
								className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
								onClick={() => setShowAllEvidence((prev) => !prev)}
							>
								{showAllEvidence
									? "Show fewer citations"
									: `Show all ${evidenceCount} citations`}
							</button>
						)}
					</div>

					<div className="space-y-4">
						{displayedEvidence.map((item, index) => (
							<div
								key={`${item.field}-${index}`}
								className="rounded-lg border border-zinc-700/30 dark:border-zinc-700/60 bg-zinc-900/5 dark:bg-zinc-900/30 p-4"
							>
								<div className="flex flex-wrap gap-2 items-center justify-between">
									<p className="text-sm font-semibold text-blue-500 dark:text-blue-300 uppercase tracking-wide">
										{item.field}
									</p>
									{item.confidence && (
										<span className="text-xs text-zinc-500 dark:text-zinc-400">
											Confidence: {item.confidence}
										</span>
									)}
								</div>

								{item.reasoning && (
									<p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
										{item.reasoning}
									</p>
								)}

								{item.citations && item.citations.length > 0 && (
									<ul className="mt-3 space-y-2">
										{item.citations.map((citation, citationIndex: number) => (
											<li
												key={`${item.field}-citation-${citationIndex}`}
												className="rounded-md border border-zinc-700/20 dark:border-zinc-700/40 bg-zinc-900/5 dark:bg-zinc-900/40 p-3"
											>
												{citation.url ? (
													<a
														href={citation.url}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors"
													>
														{citation.title || extractHostname(citation.url)}
														<ExternalLink className="h-3.5 w-3.5" />
													</a>
												) : (
													<span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
														{citation.title || "Citation"}
													</span>
												)}
												{citation.excerpts && citation.excerpts.length > 0 && (
													<p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
														{citation.excerpts[0]}
													</p>
												)}
											</li>
										))}
									</ul>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{runId && !embedded && (
				<div className="space-y-3 text-xs text-zinc-500 dark:text-zinc-400">
					<div>Task ID: {runId}</div>
					{normalizedStatus && <div>Status: {normalizedStatus}</div>}
				</div>
			)}

			{data.completion_id && !embedded && (
				<div>
					<Button
						type="button"
						variant="secondary"
						onClick={() => {
							window.open(`/?completion_id=${data.completion_id}`, "_blank");
						}}
					>
						Continue the conversation
					</Button>
				</div>
			)}
		</div>
	);
}

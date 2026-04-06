import { Film, Image, Layers, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, Card } from "~/components/ui";
import {
	useCanvasGenerations,
	useCanvasModels,
	useGenerateCanvasOutputs,
} from "~/hooks/useCanvas";
import { cn } from "~/lib/utils";
import type {
	CanvasGeneration,
	CanvasGenerateRequest,
	CanvasGenerationResult,
	CanvasMode,
} from "~/types/canvas";
import { GenerationCard, type CanvasRun } from "./GenerationCard";
import { collectFieldEnumOptions, parseReferenceImages } from "./utils";

function mapGenerationStatus(status: string | undefined): CanvasRun["status"] {
	const normalized = (status || "").toLowerCase();

	switch (normalized) {
		case "succeeded":
			return "succeeded";
		case "completed":
			return "completed";
		case "failed":
		case "canceled":
		case "cancelled":
			return "failed";
		case "queued":
			return "queued";
		case "processing":
		case "in_progress":
		case "starting":
			return "processing";
		default:
			return "processing";
	}
}

function mapQueuedGenerationToRun(
	generation: CanvasGenerationResult,
): CanvasRun {
	const generationId = generation.generationId;

	return {
		key: generationId
			? `generation-${generationId}`
			: `generation-${generation.modelId}`,
		modelId: generation.modelId,
		modelName: generation.modelName,
		generationId,
		status: mapGenerationStatus(generation.status),
		error: generation.error,
	};
}

function mapStoredGenerationToRun(
	generation: CanvasGeneration,
	modelName: string,
): CanvasRun {
	return {
		key: `generation-${generation.id}`,
		modelId: generation.modelId,
		modelName,
		generationId: generation.id,
		status: mapGenerationStatus(generation.status),
		output: generation.output,
		error: generation.error,
		createdAt: generation.createdAt,
	};
}

function sortRunsDescendingByCreatedAt(a: CanvasRun, b: CanvasRun): number {
	const aPending = !a.generationId;
	const bPending = !b.generationId;
	if (aPending && !bPending) {
		return -1;
	}
	if (!aPending && bPending) {
		return 1;
	}

	const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
	const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
	return bTs - aTs;
}

export function CanvasStudio() {
	const [mode, setMode] = useState<CanvasMode>("image");
	const [prompt, setPrompt] = useState("");
	const [negativePrompt, setNegativePrompt] = useState("");
	const [referenceInput, setReferenceInput] = useState("");
	const [aspectRatio, setAspectRatio] = useState("");
	const [resolution, setResolution] = useState("");
	const [durationSeconds, setDurationSeconds] = useState("");
	const [generateAudio, setGenerateAudio] = useState(false);
	const [modelSearch, setModelSearch] = useState("");
	const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
	const [runs, setRuns] = useState<CanvasRun[]>([]);

	const {
		data: models,
		isLoading: isModelsLoading,
		error: modelsError,
	} = useCanvasModels(mode);
	const {
		mutateAsync: generate,
		isPending,
		error: generateError,
	} = useGenerateCanvasOutputs();
	const { data: generations, refetch: refetchGenerations } =
		useCanvasGenerations(mode);

	const visibleModels = useMemo(() => {
		const source = models ?? [];
		const query = modelSearch.trim().toLowerCase();

		if (!query) {
			return source;
		}

		return source.filter((model) => {
			const text = [
				model.name,
				model.description,
				model.provider,
				...(model.strengths ?? []),
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return text.includes(query);
		});
	}, [models, modelSearch]);

	const selectedModels = useMemo(() => {
		const lookup = new Set(selectedModelIds);
		return (models ?? []).filter((model) => lookup.has(model.id));
	}, [models, selectedModelIds]);

	const canvasModelLookup = useMemo(
		() => new Map((models ?? []).map((model) => [model.id, model])),
		[models],
	);

	const historicalRuns = useMemo(() => {
		if (
			!generations ||
			generations.length === 0 ||
			canvasModelLookup.size === 0
		) {
			return [];
		}

		return generations
			.filter((generation) => canvasModelLookup.has(generation.modelId))
			.map((generation) =>
				mapStoredGenerationToRun(
					generation,
					canvasModelLookup.get(generation.modelId)?.name ||
						generation.modelName ||
						generation.modelId,
				),
			)
			.sort(sortRunsDescendingByCreatedAt);
	}, [generations, canvasModelLookup]);

	const optionModels =
		selectedModels.length > 0 ? selectedModels : (models ?? []);

	const aspectRatioOptions = useMemo(
		() => collectFieldEnumOptions(optionModels, "aspect_ratio"),
		[optionModels],
	);
	const resolutionOptions = useMemo(
		() => collectFieldEnumOptions(optionModels, "resolution"),
		[optionModels],
	);

	useEffect(() => {
		if (!models || models.length === 0) {
			setSelectedModelIds([]);
			return;
		}

		setSelectedModelIds((prev) => {
			const validIds = new Set(models.map((model) => model.id));
			return prev.filter((id) => validIds.has(id));
		});
	}, [models]);

	useEffect(() => {
		if (aspectRatioOptions.length === 0) {
			setAspectRatio("");
			return;
		}

		setAspectRatio((current) =>
			current && aspectRatioOptions.includes(current) ? current : "",
		);
	}, [aspectRatioOptions]);

	useEffect(() => {
		if (resolutionOptions.length === 0) {
			setResolution("");
			return;
		}

		setResolution((current) =>
			current && resolutionOptions.includes(current) ? current : "",
		);
	}, [resolutionOptions]);

	const handleModeChange = (nextMode: CanvasMode) => {
		setMode(nextMode);
		setRuns([]);
	};

	const handleModelToggle = (modelId: string) => {
		setSelectedModelIds((prev) =>
			prev.includes(modelId)
				? prev.filter((id) => id !== modelId)
				: [...prev, modelId],
		);
	};

	const handleGenerate = async () => {
		if (!prompt.trim() || selectedModelIds.length === 0) {
			return;
		}

		const selectedModelLookup = new Map(
			(models ?? []).map((model) => [model.id, model]),
		);

		const placeholderRuns: CanvasRun[] = selectedModelIds.map(
			(modelId, index) => {
				const model = selectedModelLookup.get(modelId);
				return {
					key: `${modelId}-pending-${index}`,
					modelId,
					modelName: model?.name ?? modelId,
					generationId: undefined,
					status: "queued",
				};
			},
		);

		setRuns(placeholderRuns);

		const payload: CanvasGenerateRequest = {
			mode,
			prompt: prompt.trim(),
			modelIds: selectedModelIds,
			referenceImages: parseReferenceImages(referenceInput),
			negativePrompt: negativePrompt.trim() || undefined,
			aspectRatio: aspectRatio || undefined,
			resolution: resolution || undefined,
			durationSeconds:
				mode === "video" && Number(durationSeconds) > 0
					? Number(durationSeconds)
					: undefined,
			generateAudio: mode === "video" ? generateAudio : undefined,
		};

		try {
			const result = await generate(payload);
			setRuns(
				result.generations.map((generation) =>
					mapQueuedGenerationToRun(generation),
				),
			);
			await refetchGenerations();
		} catch {
			setRuns([]);
		}
	};

	const displayRuns = useMemo(() => {
		const byKey = new Map<string, CanvasRun>();

		for (const run of historicalRuns) {
			byKey.set(run.key, run);
		}

		for (const run of runs) {
			const key = run.generationId ? `generation-${run.generationId}` : run.key;
			if (!byKey.has(key)) {
				byKey.set(key, { ...run, key });
			}
		}

		const mergedRuns = Array.from(byKey.values()).sort(
			sortRunsDescendingByCreatedAt,
		);
		if (mergedRuns.length > 0) {
			return mergedRuns;
		}

		if (selectedModels.length === 0) {
			return [];
		}

		const placeholders = selectedModels;
		return placeholders.map((model, index) => ({
			key: `${model.id}-placeholder-${index}`,
			modelId: model.id,
			modelName: model.name,
			status: "queued" as const,
		}));
	}, [historicalRuns, runs, selectedModels]);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
			<aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-120px)] lg:overflow-auto">
				<Card className="border-zinc-200/80 bg-white/90 p-4 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
					<div className="space-y-5">
						<div className="grid grid-cols-2 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
							<button
								type="button"
								onClick={() => handleModeChange("image")}
								className={cn(
									"flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition",
									mode === "image"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
								)}
							>
								<Image className="mr-2 h-4 w-4" />
								Image
							</button>
							<button
								type="button"
								onClick={() => handleModeChange("video")}
								className={cn(
									"flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition",
									mode === "video"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
								)}
							>
								<Film className="mr-2 h-4 w-4" />
								Video
							</button>
						</div>

						<div className="space-y-2">
							<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
								Prompt
							</label>
							<textarea
								value={prompt}
								onChange={(event) => setPrompt(event.target.value)}
								rows={4}
								className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								placeholder="Describe what to generate..."
							/>
						</div>

						<div className="space-y-2">
							<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
								Negative Prompt
							</label>
							<input
								value={negativePrompt}
								onChange={(event) => setNegativePrompt(event.target.value)}
								className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								placeholder="Optional"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
								Reference Images
							</label>
							<textarea
								value={referenceInput}
								onChange={(event) => setReferenceInput(event.target.value)}
								rows={3}
								className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								placeholder="One URL per line"
							/>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
									Models
								</label>
								<span className="text-xs text-zinc-500 dark:text-zinc-400">
									{selectedModelIds.length} selected
								</span>
							</div>
							<input
								value={modelSearch}
								onChange={(event) => setModelSearch(event.target.value)}
								className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								placeholder="Search models"
							/>

							<div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
								{visibleModels.map((model) => {
									const selected = selectedModelIds.includes(model.id);
									return (
										<button
											type="button"
											key={model.id}
											onClick={() => handleModelToggle(model.id)}
											className={cn(
												"w-full rounded-lg border px-3 py-2 text-left transition",
												selected
													? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
													: "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
											)}
										>
											<div className="flex items-center justify-between gap-2">
												<span className="text-sm font-medium">
													{model.name}
												</span>
												<span className="text-xs uppercase">
													{model.provider}
												</span>
											</div>
											{model.requiresReferenceImage && (
												<p className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
													Requires reference image
												</p>
											)}
											{typeof model.costPerRun === "number" && (
												<p className="mt-1 text-xs opacity-80">
													${model.costPerRun.toFixed(3)}
												</p>
											)}
										</button>
									);
								})}
								{!isModelsLoading && visibleModels.length === 0 && (
									<p className="px-2 py-3 text-xs text-zinc-500 dark:text-zinc-400">
										No models match this filter.
									</p>
								)}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
									Aspect
								</label>
								<select
									value={aspectRatio}
									onChange={(event) => setAspectRatio(event.target.value)}
									className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								>
									<option value="">Default</option>
									{aspectRatioOptions.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-1">
								<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
									Resolution
								</label>
								<select
									value={resolution}
									onChange={(event) => setResolution(event.target.value)}
									className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								>
									<option value="">Default</option>
									{resolutionOptions.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							</div>
						</div>

						{mode === "video" && (
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
										Duration (sec)
									</label>
									<input
										type="number"
										min={1}
										max={20}
										value={durationSeconds}
										onChange={(event) => setDurationSeconds(event.target.value)}
										className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
										placeholder="Optional"
									/>
								</div>
								<label className="flex items-end gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
									<input
										type="checkbox"
										checked={generateAudio}
										onChange={(event) => setGenerateAudio(event.target.checked)}
									/>
									Generate audio
								</label>
							</div>
						)}

						<Button
							variant="primary"
							onClick={handleGenerate}
							disabled={selectedModelIds.length === 0 || !prompt.trim()}
							isLoading={isPending}
							fullWidth
						>
							Generate
						</Button>

						{(modelsError || generateError) && (
							<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
								{modelsError instanceof Error
									? modelsError.message
									: generateError instanceof Error
										? generateError.message
										: "Could not load Canvas resources."}
							</p>
						)}
					</div>
				</Card>
			</aside>

			<section className="rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-4 dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="rounded-lg bg-zinc-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
							<Layers className="h-4 w-4" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								Generations
							</h2>
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								Outputs from selected models appear here.
							</p>
						</div>
					</div>
					<div className="text-xs text-zinc-500 dark:text-zinc-400">
						{selectedModelIds.length} active model
						{selectedModelIds.length === 1 ? "" : "s"}
					</div>
				</div>

				{isModelsLoading && (
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<div
								key={`loading-${index}`}
								className="h-48 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
							/>
						))}
					</div>
				)}

				{!isModelsLoading && displayRuns.length === 0 && (
					<div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
						<Sparkles className="mb-2 h-6 w-6" />
						<p>Select models on the left and run your first generation.</p>
					</div>
				)}

				<div className="columns-1 gap-4 md:columns-2 xl:columns-3">
					{displayRuns.map((run, index) => (
						<GenerationCard
							key={run.key}
							run={run}
							index={index}
							mode={mode}
							aspectRatio={aspectRatio || undefined}
						/>
					))}
				</div>
			</section>
		</div>
	);
}

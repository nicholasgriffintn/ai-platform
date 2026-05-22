import { useEffect, useMemo, useState } from "react";

import { useCanvasGenerations, useCanvasModels, useGenerateCanvasOutputs } from "~/hooks/useCanvas";
import type {
	CanvasGeneration,
	CanvasGenerateRequest,
	CanvasGenerationResult,
	CanvasMode,
} from "~/types/canvas";
import { useDrawingStudio } from "./Drawing/useDrawingStudio";
import type { CanvasRun } from "./GenerationCard";
import {
	buildCanvasModelOptions,
	collectCanvasModelOptionFields,
	collectFieldEnumOptions,
	parseReferenceImages,
} from "./utils";

export type CanvasStudioMode = CanvasMode | "drawing";

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

function mapQueuedGenerationToRun(generation: CanvasGenerationResult): CanvasRun {
	const generationId = generation.generationId;

	return {
		key: generationId ? `generation-${generationId}` : `generation-${generation.modelId}`,
		modelId: generation.modelId,
		modelName: generation.modelName,
		generationId,
		status: mapGenerationStatus(generation.status),
		error: generation.error,
	};
}

function mapStoredGenerationToRun(generation: CanvasGeneration, modelName: string): CanvasRun {
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

interface UseCanvasStudioOptions {
	enabled?: boolean;
}

export function useCanvasStudio({ enabled = true }: UseCanvasStudioOptions = {}) {
	const [mode, setMode] = useState<CanvasStudioMode>("image");
	const [prompt, setPrompt] = useState("");
	const [negativePrompt, setNegativePrompt] = useState("");
	const [referenceInput, setReferenceInput] = useState("");
	const [aspectRatio, setAspectRatio] = useState("");
	const [resolution, setResolution] = useState("");
	const [durationSeconds, setDurationSeconds] = useState("");
	const [generateAudio, setGenerateAudio] = useState(false);
	const [modelSearch, setModelSearch] = useState("");
	const [modelOptionValues, setModelOptionValues] = useState<Record<string, string | boolean>>({});
	const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
	const [runs, setRuns] = useState<CanvasRun[]>([]);

	const mediaMode: CanvasMode = mode === "drawing" ? "image" : mode;
	const mediaEnabled = enabled && mode !== "drawing";
	const drawing = useDrawingStudio(enabled && mode === "drawing");

	const {
		data: models,
		isLoading: isModelsLoading,
		error: modelsError,
	} = useCanvasModels(mediaMode, mediaEnabled);
	const { mutateAsync: generate, isPending, error: generateError } = useGenerateCanvasOutputs();
	const { data: generations, refetch: refetchGenerations } = useCanvasGenerations(
		mediaMode,
		mediaEnabled,
	);

	const visibleModels = useMemo(() => {
		const source = models ?? [];
		const query = modelSearch.trim().toLowerCase();

		if (!query) {
			return source;
		}

		return source.filter((model) => {
			const text = [model.name, model.description, model.provider, ...(model.strengths ?? [])]
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
		if (!generations || generations.length === 0 || canvasModelLookup.size === 0) {
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

	const optionModels = selectedModels.length > 0 ? selectedModels : (models ?? []);

	const aspectRatioOptions = useMemo(
		() => collectFieldEnumOptions(optionModels, "aspect_ratio"),
		[optionModels],
	);
	const resolutionOptions = useMemo(
		() => collectFieldEnumOptions(optionModels, "resolution"),
		[optionModels],
	);
	const modelOptionFields = useMemo(
		() => collectCanvasModelOptionFields(selectedModels),
		[selectedModels],
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

		setAspectRatio((current) => (current && aspectRatioOptions.includes(current) ? current : ""));
	}, [aspectRatioOptions]);

	useEffect(() => {
		if (resolutionOptions.length === 0) {
			setResolution("");
			return;
		}

		setResolution((current) => (current && resolutionOptions.includes(current) ? current : ""));
	}, [resolutionOptions]);

	useEffect(() => {
		const fieldsByName = new Map(modelOptionFields.map((field) => [field.name, field]));

		setModelOptionValues((current) => {
			const next = Object.fromEntries(
				Object.entries(current).filter(([name, value]) => {
					const field = fieldsByName.get(name);
					if (!field) {
						return false;
					}

					if (field.enum?.length && typeof value === "string") {
						return field.enum.map(String).includes(value);
					}

					return true;
				}),
			);

			return Object.keys(next).length === Object.keys(current).length ? current : next;
		});
	}, [modelOptionFields]);

	const handleModeChange = (nextMode: CanvasStudioMode) => {
		setMode(nextMode);
		setRuns([]);
	};

	const handleModelToggle = (modelId: string) => {
		setSelectedModelIds((prev) =>
			prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
		);
	};

	const setModelOptionValue = (fieldName: string, value: string | boolean) => {
		setModelOptionValues((current) => {
			if (value === "" || value === false) {
				const { [fieldName]: _removed, ...rest } = current;
				return rest;
			}

			return {
				...current,
				[fieldName]: value,
			};
		});
	};

	const canvasOptionValues = useMemo(
		() => ({
			...modelOptionValues,
			...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
			...(resolution ? { resolution } : {}),
		}),
		[aspectRatio, modelOptionValues, resolution],
	);

	const setCanvasOptionValue = (fieldName: string, value: string | boolean) => {
		if (fieldName === "aspect_ratio") {
			setAspectRatio(typeof value === "string" ? value : "");
			return;
		}

		if (fieldName === "resolution") {
			setResolution(typeof value === "string" ? value : "");
			return;
		}

		setModelOptionValue(fieldName, value);
	};

	const handleGenerate = async () => {
		if (!prompt.trim() || selectedModelIds.length === 0) {
			return;
		}

		const selectedModelLookup = new Map((models ?? []).map((model) => [model.id, model]));

		const placeholderRuns: CanvasRun[] = selectedModelIds.map((modelId, index) => {
			const model = selectedModelLookup.get(modelId);
			return {
				key: `${modelId}-pending-${index}`,
				modelId,
				modelName: model?.name ?? modelId,
				generationId: undefined,
				status: "queued",
			};
		});

		setRuns(placeholderRuns);

		const payload: CanvasGenerateRequest = {
			mode: mediaMode,
			prompt: prompt.trim(),
			modelIds: selectedModelIds,
			referenceImages: parseReferenceImages(referenceInput),
			negativePrompt: negativePrompt.trim() || undefined,
			aspectRatio: aspectRatio || undefined,
			resolution: resolution || undefined,
			durationSeconds:
				mediaMode === "video" && Number(durationSeconds) > 0 ? Number(durationSeconds) : undefined,
			generateAudio: mediaMode === "video" ? generateAudio : undefined,
			modelOptions: buildCanvasModelOptions(modelOptionFields, modelOptionValues),
		};

		try {
			const result = await generate(payload);
			setRuns(result.generations.map((generation) => mapQueuedGenerationToRun(generation)));
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

		const mergedRuns = Array.from(byKey.values()).sort(sortRunsDescendingByCreatedAt);
		if (mergedRuns.length > 0) {
			return mergedRuns;
		}

		if (selectedModels.length === 0) {
			return [];
		}

		return selectedModels.map((model, index) => ({
			key: `${model.id}-placeholder-${index}`,
			modelId: model.id,
			modelName: model.name,
			status: "queued" as const,
		}));
	}, [historicalRuns, runs, selectedModels]);

	const error = modelsError || generateError;

	return {
		mode,
		mediaMode,
		drawing,
		prompt,
		negativePrompt,
		referenceInput,
		aspectRatio,
		resolution,
		durationSeconds,
		generateAudio,
		modelSearch,
		modelOptionFields,
		modelOptionValues: canvasOptionValues,
		selectedModelIds,
		visibleModels,
		aspectRatioOptions,
		resolutionOptions,
		displayRuns,
		isModelsLoading,
		isGenerating: isPending,
		error,
		setPrompt,
		setNegativePrompt,
		setReferenceInput,
		setAspectRatio,
		setResolution,
		setDurationSeconds,
		setGenerateAudio,
		setModelSearch,
		setModelOptionValue: setCanvasOptionValue,
		handleModeChange,
		handleModelToggle,
		handleGenerate,
	};
}

export type CanvasStudioState = ReturnType<typeof useCanvasStudio>;

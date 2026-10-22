import {
  getSourceMediaType,
  readSourceGeneration,
  type GenerateSourceMediaRequest,
  type ReplicateModel,
  type ReplicatePrediction,
  type Source,
  type SourceGenerationRejection,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import type {
  CanvasGenerateRequest,
  CanvasGenerateResponse,
  CanvasGeneration,
  CanvasMode,
  CanvasModel,
  Drawing,
  GuessResponse,
} from "@ngriffin_uk/polychat-schemas/experiences";

import { withProjectScope } from "./project-scope.js";
import { requestJson, resource } from "./resource.js";
import { getSource, getSourceContentUrl, listSources } from "./sources.js";

interface StartedSourceGenerations {
  sources: Source[];
  rejected: SourceGenerationRejection[];
}

type GenerationStatus = CanvasGeneration["status"];

function generationStatus(source: SourceSummary): GenerationStatus {
  if (source.status === "failed") {
    return "failed";
  }

  return source.status === "processing" ? "processing" : "succeeded";
}

/** Shapes a source's file or text the way the generation views render model output. */
export function getGeneratedSourceOutput(source: SourceSummary | Source): unknown {
  const mediaType = source.file ? getSourceMediaType(source.file.mimeType) : null;

  if (mediaType) {
    const key = `${mediaType}_url`;

    return [{ type: key, [key]: { url: getSourceContentUrl(source.id) } }];
  }

  return "content" in source && source.content
    ? [{ type: "text", text: source.content }]
    : undefined;
}

function startGenerations(request: GenerateSourceMediaRequest): Promise<StartedSourceGenerations> {
  return requestJson<StartedSourceGenerations>("/sources/generations", "POST", request, {
    timeoutMs: null,
  });
}

export function toCanvasGeneration(source: SourceSummary): CanvasGeneration {
  const generation = readSourceGeneration(source.metadata);

  return {
    id: source.id,
    modelId: generation?.modelId ?? "",
    modelName: generation?.modelName,
    provider: generation?.provider,
    mode: generation?.mode === "video" ? "video" : "image",
    status: generationStatus(source),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt ?? source.createdAt,
    input: generation?.input,
    output: getGeneratedSourceOutput(source),
    error: generation?.error,
  };
}

export function toReplicatePrediction(source: SourceSummary | Source): ReplicatePrediction {
  const generation = readSourceGeneration(source.metadata);

  return {
    id: source.id,
    status: generationStatus(source),
    modelId: generation?.modelId ?? "",
    modelName: generation?.modelName,
    input: generation?.input ?? {},
    createdAt: source.createdAt,
    output: getGeneratedSourceOutput(source),
    error: generation?.error,
  };
}

export function toDrawing(source: SourceSummary): Drawing {
  const generation = readSourceGeneration(source.metadata);
  const sketchId = generation?.sourceIds?.[0];

  return {
    id: source.id,
    description: generation?.prompt ?? source.title,
    drawingUrl: sketchId ? getSourceContentUrl(sketchId) : "",
    paintingUrl: getSourceContentUrl(source.id),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt ?? source.createdAt,
  };
}

export function fetchStudioModels(mode: CanvasMode): Promise<CanvasModel[]> {
  return resource<CanvasModel>("/sources/generations/models").listAll({ mode });
}

export async function startStudioGeneration(
  request: CanvasGenerateRequest,
): Promise<CanvasGenerateResponse> {
  const { projectId, ...input } = request;
  const started = await startGenerations({ ...input, type: "studio", projectId });

  return {
    generations: [
      ...started.sources.map((source) => {
        const generation = toCanvasGeneration(source);

        return {
          modelId: generation.modelId,
          modelName: generation.modelName ?? generation.modelId,
          provider: generation.provider,
          status: generation.status,
          generationId: source.id,
          error: generation.error,
        };
      }),
      ...started.rejected.map((rejection) => ({
        modelId: rejection.modelId ?? "",
        modelName: rejection.modelName ?? rejection.modelId ?? "",
        status: "failed" as const,
        error: rejection.error,
      })),
    ],
  };
}

export async function listStudioGenerations(
  mode?: CanvasMode,
  projectId?: string,
): Promise<CanvasGeneration[]> {
  const sources = await listSources({ projectId, generation: "studio" });

  return sources.map(toCanvasGeneration).filter((generation) => !mode || generation.mode === mode);
}

export const fetchReplicateModels = (): Promise<ReplicateModel[]> =>
  resource<ReplicateModel>("/sources/generations/replicate_models").listAll();

export async function runReplicateModel(
  request: { modelId: string; input: Record<string, unknown> },
  projectId?: string,
): Promise<ReplicatePrediction> {
  const started = await startGenerations({ ...request, type: "model", projectId });
  const [source] = started.sources;

  if (!source) {
    throw new Error(started.rejected[0]?.error ?? "The prediction was not started");
  }

  return toReplicatePrediction(source);
}

export async function fetchReplicatePredictions(
  projectId?: string,
): Promise<ReplicatePrediction[]> {
  return (await listSources({ projectId, generation: "model" })).map(toReplicatePrediction);
}

export async function fetchReplicatePrediction(sourceId: string): Promise<ReplicatePrediction> {
  return toReplicatePrediction(await getSource(sourceId));
}

export async function fetchDrawings(projectId?: string): Promise<Drawing[]> {
  return (await listSources({ projectId, generation: "drawing" })).map(toDrawing);
}

export async function fetchDrawing(sourceId: string): Promise<Drawing> {
  return toDrawing(await getSource(sourceId));
}

function drawingForm(drawing: File): FormData {
  const formData = new FormData();

  formData.append("drawing", drawing);

  return formData;
}

export function paintDrawing(drawing: File, projectId?: string): Promise<Source> {
  return requestJson<Source>(
    withProjectScope("/sources/drawings", projectId),
    "POST",
    drawingForm(drawing),
    { timeoutMs: null },
  );
}

export function guessDrawing(drawing: File, projectId?: string): Promise<GuessResponse> {
  return requestJson<GuessResponse>(
    withProjectScope("/sources/drawings/guess", projectId),
    "POST",
    drawingForm(drawing),
  );
}

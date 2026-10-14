import z from "zod/v4";

export type CanvasMode = "image" | "video";
export type CanvasGenerationStatus = "queued" | "processing" | "succeeded" | "completed" | "failed";

export interface CanvasInputField {
  name: string;
  type: string | string[];
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
}

export interface CanvasModel {
  id: string;
  name: string;
  description?: string;
  provider: string;
  costPerRun?: number;
  requiresReferenceImage?: boolean;
  modalities: {
    input: string[];
    output?: string[];
  };
  strengths?: string[];
  isFeatured?: boolean;
  inputSchema?: {
    fields: CanvasInputField[];
    reference?: string;
  };
}

export const generateCanvasSchema = z.object({
  projectId: z.string().min(1).optional(),
  mode: z.enum(["image", "video"]),
  prompt: z.string().min(1),
  modelIds: z.array(z.string().min(1)).min(1).max(12),
  referenceImages: z.array(z.string()).max(8).optional(),
  negativePrompt: z.string().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().max(20).optional(),
  generateAudio: z.boolean().optional(),
  modelOptions: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .optional(),
});

export const listCanvasGenerationsQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  mode: z.enum(["image", "video"]).optional(),
});

export type CanvasGenerateRequest = z.infer<typeof generateCanvasSchema>;

export interface CanvasGenerationResult {
  modelId: string;
  modelName: string;
  provider?: string;
  status: CanvasGenerationStatus;
  generationId?: string;
  error?: string;
}

export const canvasGenerationSchema = z.object({
  id: z.string(),
  itemId: z.string().nullable().optional(),
  modelId: z.string(),
  modelName: z.string().optional(),
  provider: z.string().optional(),
  mode: z.enum(["image", "video"]).optional(),
  status: z.enum(["queued", "processing", "succeeded", "completed", "failed"]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  predictionData: z.unknown().optional(),
});

export type CanvasGeneration = z.infer<typeof canvasGenerationSchema>;

export interface CanvasGenerateResponse {
  generations: CanvasGenerationResult[];
}

export interface CanvasGenerationsResponse {
  generations: CanvasGeneration[];
}

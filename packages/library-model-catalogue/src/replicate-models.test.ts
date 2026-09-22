import { describe, expect, it } from "vitest";

import { getCatalogueProviderModels } from "./catalogue.js";

const requestedSchemas = {
  "alibaba/wan-3": [
    "prompt",
    "image",
    "negative_prompt",
    "resolution",
    "aspect_ratio",
    "duration",
    "enable_prompt_expansion",
    "seed",
  ],
  "prunaai/p-video": [
    "prompt",
    "image",
    "last_frame_image",
    "audio",
    "duration",
    "aspect_ratio",
    "resolution",
    "fps",
    "draft",
    "prompt_upsampling",
    "disable_safety_filter",
    "save_audio",
    "seed",
    "no_op",
  ],
  "kwaivgi/kling-v3-omni-video": [
    "prompt",
    "start_image",
    "end_image",
    "reference_images",
    "reference_video",
    "video_reference_type",
    "keep_original_sound",
    "generate_audio",
    "mode",
    "aspect_ratio",
    "duration",
    "multi_prompt",
  ],
  "bytedance/seedance-2.0": [
    "prompt",
    "image",
    "last_frame_image",
    "reference_images",
    "reference_videos",
    "reference_audios",
    "duration",
    "resolution",
    "aspect_ratio",
    "generate_audio",
    "seed",
  ],
  "luma/ray-3.2": [
    "prompt",
    "aspect_ratio",
    "resolution",
    "duration",
    "hdr",
    "exr_export",
    "loop",
    "start_image",
    "end_image",
  ],
  "openai/gpt-image-2": [
    "prompt",
    "aspect_ratio",
    "input_images",
    "number_of_images",
    "quality",
    "background",
    "output_compression",
    "output_format",
    "moderation",
    "user_id",
  ],
  "leonardoai/lucid-origin": [
    "prompt",
    "aspect_ratio",
    "generation_mode",
    "contrast",
    "prompt_enhance",
    "num_images",
    "style",
  ],
  "quiverai/arrow-1.1-max": [
    "prompt",
    "instructions",
    "references",
    "temperature",
    "top_p",
    "presence_penalty",
  ],
  "quiverai/arrow-1.1": [
    "prompt",
    "instructions",
    "references",
    "temperature",
    "top_p",
    "presence_penalty",
  ],
  "bria/fibo": [
    "prompt",
    "image",
    "structured_prompt",
    "negative_prompt",
    "guidance_scale",
    "aspect_ratio",
    "seed",
  ],
  "google/imagen-4": [
    "prompt",
    "aspect_ratio",
    "image_size",
    "safety_filter_level",
    "output_format",
  ],
  "google/imagen-4-ultra": [
    "prompt",
    "aspect_ratio",
    "image_size",
    "safety_filter_level",
    "output_format",
  ],
  "qwen/qwen-image": [
    "aspect_ratio",
    "image_size",
    "output_format",
    "seed",
    "image",
    "prompt",
    "go_fast",
    "guidance",
    "strength",
    "lora_scale",
    "lora_weights",
    "enhance_prompt",
    "output_quality",
    "negative_prompt",
    "extra_lora_scale",
    "extra_lora_weights",
    "num_inference_steps",
    "disable_safety_checker",
  ],
  "minimax/image-01": [
    "aspect_ratio",
    "prompt",
    "number_of_images",
    "prompt_optimizer",
    "subject_reference",
  ],
  "datacte/proteus-v0.3": [
    "prompt",
    "negative_prompt",
    "image",
    "mask",
    "width",
    "height",
    "num_outputs",
    "scheduler",
    "num_inference_steps",
    "guidance_scale",
    "prompt_strength",
    "seed",
    "apply_watermark",
    "disable_safety_checker",
  ],
} as const;

describe("Replicate media catalogue", () => {
  const models = Object.values(getCatalogueProviderModels("replicate"));

  it.each(Object.entries(requestedSchemas))("exposes the current %s input schema", (id, fields) => {
    const model = models.find((candidate) => candidate.matchingModel === id);

    expect(model).toBeDefined();
    expect(model?.inputSchema?.reference).toBe(`https://replicate.com/${id}`);
    expect(model?.inputSchema?.fields.map((field) => field.name)).toEqual(fields);
    expect(model?.inputSchema?.fields.find((field) => field.name === "prompt")?.required).toBe(
      id === "datacte/proteus-v0.3" ? undefined : true,
    );
  });

  it("keeps provider-managed API credentials out of generation inputs", () => {
    const model = models.find((candidate) => candidate.matchingModel === "openai/gpt-image-2");

    expect(model?.inputSchema?.fields.some((field) => field.name === "openai_api_key")).toBe(false);
  });

  it("does not expose chat reasoning controls on the MiniMax image model", () => {
    const model = models.find((candidate) => candidate.matchingModel === "minimax/image-01");

    expect(model?.reasoningConfig).toBeUndefined();
  });
});

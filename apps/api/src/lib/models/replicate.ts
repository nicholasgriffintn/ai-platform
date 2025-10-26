import type { ModelConfig } from "~/types";

export const replicateModelConfig: ModelConfig = {
  "bytedance/seedream-4": {
    name: "Bytedance Seedream 4",
    matchingModel: "bytedance/seedream-4",
    provider: "replicate",
    type: ["text-to-image"],
    costPerRun: 0.03,
    description:
      "Unified text-to-image generation and precise single-sentence editing at up to 4K resolution ",
  },
  "black-forest-labs/flux-schnell": {
    name: "Black Forest Labs Flux Schnell",
    matchingModel: "black-forest-labs/flux-schnell",
    provider: "replicate",
    type: ["text-to-image"],
    costPerRun: 0.01,
    description:
      "Use this fast version of black-forest-labs/flux-schnell when speed and cost are more important than quality.",
  },
  "ideogram-ai/ideogram-v3-turbo": {
    name: "Ideogram V3 Turbo",
    matchingModel: "ideogram-ai/ideogram-v3-turbo",
    provider: "replicate",
    type: ["text-to-image"],
    costPerRun: 0.03,
    description:
      "Turbo is the fastest and cheapest Ideogram v3. v3 creates images with stunning realism, creative designs, and consistent styles.",
  },
  "recraft-ai/recraft-v3-svg": {
    name: "Recraft V3 SVG",
    matchingModel: "recraft-ai/recraft-v3-svg",
    provider: "replicate",
    type: ["text-to-image"],
    costPerRun: 0.03,
    description:
      "Recraft V3 SVG (code-named red_panda) is a text-to-image model with the ability to generate high quality SVG images including logotypes, and icons. The model supports a wide list of styles. ",
  },
  "lightricks/ltx-2-fast": {
    name: "Lightricks LTX 2 Fast",
    matchingModel: "lightricks/ltx-2-fast",
    provider: "replicate",
    type: ["text-to-video"],
    costPerRun: 0.16,
    description:
      " Ideal for rapid ideation and mobile workflows. Perfect for creators who need instant feedback, real-time previews, or high-throughput content.",
  },
  "bytedance/seedance-1-pro": {
    name: "Bytedance Seedance 1 Pro",
    matchingModel: "bytedance/seedance-1-pro",
    provider: "replicate",
    type: ["text-to-video"],
    costPerRun: 0.15,
    description:
      "A pro version of Seedance that offers text-to-video and image-to-video support for 5s or 10s videos, at 480p and 1080p resolution ",
  },
  "bytedance/seedance-1-pro-fast": {
    name: "Bytedance Seedance 1 Pro Fast",
    matchingModel: "bytedance/seedance-1-pro-fast",
    provider: "replicate",
    type: ["text-to-video"],
    costPerRun: 0.06,
    description: "A faster and cheaper version of Seedance 1 Pro",
  },
  "openai/sora-2": {
    name: "OpenAI Sora 2",
    matchingModel: "openai/sora-2",
    provider: "replicate",
    type: ["text-to-video"],
    costPerRun: 0.1,
    description: "OpenAI's Flagship video generation with synced audio ",
  },
  "google/nano-banana": {
    name: "Google Nano Banana",
    matchingModel: "google/nano-banana",
    provider: "replicate",
    type: ["text-to-image"],
    costPerRun: 0.039,
    description: "Google's latest image editing model in Gemini 2.5 ",
  },
  "google/veo-3.1": {
    name: "Google VEO 3.1",
    matchingModel: "google/veo-3.1",
    provider: "replicate",
    type: ["text-to-video"],
    costPerRun: 0.4,
    description:
      "New and improved version of Veo 3, with higher-fidelity video, context-aware audio, reference image and last frame support ",
  },
  "stability-ai/stable-audio-2.5": {
    name: "Stability Audio 2.5",
    matchingModel: "stability-ai/stable-audio-2.5",
    provider: "replicate",
    type: ["text-to-audio"],
    costPerRun: 0.2,
    description: "Generate high-quality music and sound from text prompts",
  },
  "minimax/music-1.5": {
    name: "Minimax Music 1.5",
    matchingModel: "minimax/music-1.5",
    provider: "replicate",
    type: ["text-to-audio"],
    costPerRun: 0.03,
    description:
      "Music-1.5: Full-length songs (up to 4 mins) with natural vocals & rich instrumentation",
  },
};

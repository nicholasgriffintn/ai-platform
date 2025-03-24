import type { ModelConfig } from "../../types";

// TODO: THere are some issues with the image models, probably whisper too, need to go over these
export const workersAiModelConfig: ModelConfig = {
  whisper: {
    name: "OpenAI Whisper",
    matchingModel: "@cf/openai/whisper",
    provider: "workers-ai",
    type: ["speech"],
  },
  "whisper-large-v3-turbo": {
    name: "OpenAI Whisper Large v3 Turbo",
    description:
      "A faster, more accurate speech-to-text model when compared to the base Whisper model.",
    matchingModel: "@cf/openai/whisper-large-v3-turbo",
    provider: "workers-ai",
    type: ["speech"],
  },
  melotts: {
    name: "Melotts",
    matchingModel: "@cf/myshell-ai/melotts",
    description:
      "Melotts is a text-to-speech model that can generate high-quality speech from text.",
    provider: "workers-ai",
    type: ["text-to-speech"],
  },
  "llama-3.3-70b-instruct": {
    name: "Meta Llama 3.3 70B Instruct",
    matchingModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    description:
      "Meta's new 70B model that claims to have the same performance as the 450B model but more cost effective.",
    provider: "workers-ai",
    type: ["text"],
    supportsResponseFormat: true,
  },
  "llama-3.2-1b-instruct": {
    name: "Meta Llama 3.2 1B Instruct",
    matchingModel: "@cf/meta/llama-3.2-1b-instruct",
    description:
      "The Llama 3.2 instruction-tuned text only models are optimized for multilingual dialogue use cases, including agentic retrieval and summarization tasks.",
    provider: "workers-ai",
    type: ["text"],
  },
  "llama-3.2-3b-instruct": {
    name: "Meta Llama 3.2 3B Instruct",
    matchingModel: "@cf/meta/llama-3.2-3b-instruct",
    description:
      "The Llama 3.2 instruction-tuned text only models are optimized for multilingual dialogue use cases, including agentic retrieval and summarization tasks.",
    provider: "workers-ai",
    type: ["text"],
  },
  "llama-3.1-70b-instruct": {
    name: "Meta Llama 3.1 70B Instruct",
    matchingModel: "@cf/meta/llama-3.1-70b-instruct",
    description:
      "The Meta Llama 3.1 collection of multilingual large language models (LLMs) is a collection of pretrained and instruction tuned generative models. The Llama 3.1 instruction tuned text only models are optimized for multilingual dialogue use cases and outperform many of the available open source and closed chat models on common industry benchmarks.",
    provider: "workers-ai",
    type: ["text"],
    supportsResponseFormat: true,
  },
  "hermes-2-pro-mistral-7b": {
    name: "Hermes 2 Pro Mistral 7B",
    matchingModel: "@hf/nousresearch/hermes-2-pro-mistral-7b",
    description:
      "An upgraded, retrained version of Nous Hermes 2, consisting of an updated and cleaned version of the OpenHermes 2.5 Dataset, as well as a newly introduced Function Calling and JSON Mode dataset developed in-house.",
    provider: "workers-ai",
    type: ["text"],
    supportsFunctions: true,
    isFree: true,
    isFeatured: true,
    supportsResponseFormat: true,
    contextWindow: 24000,
    maxTokens: 1024,
  },
  llava: {
    name: "HuggingFace Llava 1.5 7B",
    matchingModel: "@cf/llava-hf/llava-1.5-7b-hf",
    provider: "workers-ai",
    type: ["image-to-text"],
  },
  flux: {
    name: "Black Forest Labs Flux 1 Schnell",
    matchingModel: "@cf/black-forest-labs/flux-1-schnell",
    description:
      "FLUX.1 [schnell] is a 12 billion parameter rectified flow transformer capable of generating images from text descriptions.",
    provider: "workers-ai",
    type: ["text-to-image"],
  },
  "stable-diffusion-1.5-img2img": {
    name: "Stable Diffusion 1.5 Img2Img",
    matchingModel: "@cf/runwayml/stable-diffusion-v1-5-img2img",
    provider: "workers-ai",
    type: ["image-to-image"],
  },
  "stable-diffusion-1.5-inpainting": {
    name: "Stable Diffusion 1.5 Inpainting",
    matchingModel: "@cf/runwayml/stable-diffusion-v1-5-inpainting",
    provider: "workers-ai",
    type: ["image-to-image"],
  },
  "stable-diffusion-xl-base-1.0": {
    name: "Stable Diffusion XL Base 1.0",
    matchingModel: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    description:
      "Diffusion-based text-to-image generative model by Stability AI. Generates and modify images based on text prompts.",
    provider: "workers-ai",
    type: ["text-to-image"],
  },
  "stable-diffusion-xl-lightning": {
    name: "Stable Diffusion XL Lightning",
    matchingModel: "@cf/bytedance/stable-diffusion-xl-lightning",
    description:
      "SDXL-Lightning is a lightning-fast text-to-image generation model. It can generate high-quality 1024px images in a few steps.",
    provider: "workers-ai",
    type: ["text-to-image"],
  },
  openchat: {
    name: "OpenChat 3.5",
    matchingModel: "@cf/openchat/openchat-3.5-0106",
    description:
      "OpenChat is an innovative library of open-source language models, fine-tuned with C-RLFT - a strategy inspired by offline reinforcement learning.",
    provider: "workers-ai",
    type: ["text"],
    isFree: true,
  },
  sqlcoder: {
    name: "SQLCoder 7B",
    matchingModel: "@cf/defog/sqlcoder-7b-2",
    description:
      "SQLCoder is a model trained on SQL queries and their corresponding natural language descriptions. It can generate SQL queries from natural language descriptions and vice versa.",
    provider: "workers-ai",
    type: ["coding"],
    isFree: true,
  },
  tinyllama: {
    name: "TinyLlama 1.1B Chat v1.0",
    matchingModel: "@cf/tinyllama/tinyllama-1.1b-chat-v1.0",
    description:
      "The TinyLlama project aims to pretrain a 1.1B Llama model on 3 trillion tokens. This is the chat model finetuned on top of TinyLlama/TinyLlama-1.1B-intermediate-step-1431k-3T.",
    provider: "workers-ai",
    type: ["text"],
    isFree: true,
  },
  "una-cybertron-7b-v2": {
    name: "Una Cybertron 7B v2",
    matchingModel: "@cf/fblgit/una-cybertron-7b-v2-bf16",
    description:
      "Cybertron 7B v2 is a 7B MistralAI based model, best on it's series. It was trained with SFT, DPO and UNA (Unified Neural Alignment) on multiple datasets.",
    provider: "workers-ai",
    type: ["text"],
    isFree: true,
  },
  "bge-large-en-v1.5": {
    name: "BGE Large English v1.5",
    matchingModel: "@cf/baai/bge-base-en-v1.5",
    provider: "workers-ai",
    type: ["embedding"],
  },
  "bge-m3": {
    name: "BGE M3",
    description:
      "A multi-lingual embeddings model that supports over 100 languages. It can also simultaneously perform dense retrieval, multi-vector retrieval, and sparse retrieval, with the ability to process inputs of different granularities.",
    matchingModel: "@cf/baai/bge-m3",
    provider: "workers-ai",
    type: ["embedding"],
  },
  "bge-reranker-base": {
    name: "BGE Reranker Base",
    description:
      "For use after the initial vector search to find the most relevant documents to return to a user by reranking the outputs.",
    matchingModel: "@cf/baai/bge-reranker-base",
    provider: "workers-ai",
    type: ["reranking"],
  },
};

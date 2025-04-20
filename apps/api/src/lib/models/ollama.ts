import type { ModelConfig } from "~/types";

export const ollamaModelConfig: ModelConfig = {
  "ollama-gemma3-1b": {
    name: "Ollama Gemma 3 1B",
    matchingModel: "gemma3:1b",
    provider: "ollama",
    type: ["text"],
    strengths: ["summarization"],
    contextWindow: 32000,
  },
  "ollama-gemma3-4b": {
    name: "Ollama Gemma 3 4B",
    matchingModel: "gemma3:4b",
    provider: "ollama",
    type: ["text"],
    multimodal: true,
    strengths: ["summarization", "multilingual", "creative"],
    contextWindow: 128000,
  },
  "ollama-gemma3-12b": {
    name: "Ollama Gemma 3 12B",
    matchingModel: "gemma3:12b",
    provider: "ollama",
    type: ["text"],
    multimodal: true,
    strengths: ["summarization", "multilingual", "creative"],
    contextWindow: 128000,
  },
  "ollama-gemma3-27b": {
    name: "Ollama Gemma 3 27B",
    matchingModel: "gemma3:27b",
    provider: "ollama",
    type: ["text"],
    multimodal: true,
    strengths: ["summarization", "multilingual", "creative"],
    contextWindow: 128000,
  },
};

import type { ModelConfig } from "../../types";

export const togetherAiModelConfig: ModelConfig = {
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": {
    name: "Meta Llama 3.3 70B Instruct Turbo",
    description:
      "The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out). The Llama 3.3 instruction tuned text only model is optimized for multilingual dialogue use cases and outperform many of the available open source and closed chat models on common industry benchmarks.",
    matchingModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    provider: "together-ai",
    type: ["text"],
    costPer1kOutputTokens: 0.00088,
    costPer1kInputTokens: 0.00088,
  },
  "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free": {
    name: "Meta Llama 3.3 70B Instruct Turbo Free",
    description:
      "The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out). The Llama 3.3 instruction tuned text only model is optimized for multilingual dialogue use cases and outperform many of the available open source and closed chat models on common industry benchmarks.",
    matchingModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    provider: "together-ai",
    type: ["text"],
    isFree: true,
  },
  "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo": {
    name: "Meta Llama 3.2 90B Vision Instruct Turbo",
    description:
      "Llama 3.2 is an auto-regressive language model that uses an optimized transformer architecture. The tuned versions use supervised fine-tuning (SFT) and reinforcement learning with human feedback (RLHF) to align with human preferences for helpfulness and safety.",
    matchingModel: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
    provider: "together-ai",
    type: ["image-to-text"],
    multimodal: true,
    costPer1kOutputTokens: 0.0012,
    costPer1kInputTokens: 0.0012,
  },
  "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo": {
    name: "Meta Llama 3.2 11B Vision Instruct Turbo",
    description:
      "Llama 3.2 is an auto-regressive language model that uses an optimized transformer architecture. The tuned versions use supervised fine-tuning (SFT) and reinforcement learning with human feedback (RLHF) to align with human preferences for helpfulness and safety.",
    matchingModel: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
    provider: "together-ai",
    type: ["image-to-text"],
    multimodal: true,
    costPer1kOutputTokens: 0.00018,
    costPer1kInputTokens: 0.00018,
  },
  "meta-llama/Llama-Vision-Free": {
    name: "Meta Llama Vision Free",
    description:
      "Llama 3.2 is an auto-regressive language model that uses an optimized transformer architecture. The tuned versions use supervised fine-tuning (SFT) and reinforcement learning with human feedback (RLHF) to align with human preferences for helpfulness and safety.",
    matchingModel: "meta-llama/Llama-Vision-Free",
    provider: "together-ai",
    type: ["image-to-text"],
    isFree: true,
    multimodal: true,
  },
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": {
    name: "Meta Llama 3.1 405B Instruct Turbo",
    description:
      "Llama 3.1 is an auto-regressive language model that uses an optimized transformer architecture. The tuned versions use supervised fine-tuning (SFT) and reinforcement learning with human feedback (RLHF) to align with human preferences for helpfulness and safety.",
    matchingModel: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    provider: "together-ai",
    type: ["text"],
    costPer1kOutputTokens: 0.0035,
    costPer1kInputTokens: 0.0035,
  },
  "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free": {
    name: "DeepSeek R1 Distill Llama 70B Free",
    description:
      "DeepSeek-R1-Distill-Qwen-32B outperforms OpenAI-o1-mini across various benchmarks, achieving new state-of-the-art results for dense models.",
    matchingModel: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    provider: "together-ai",
    type: ["text"],
    isFree: true,
  },
};

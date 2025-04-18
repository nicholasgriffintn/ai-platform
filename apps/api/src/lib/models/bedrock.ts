import type { ModelConfig } from "../../types";
import { createModelConfig, createModelConfigObject } from "./utils";

const PROVIDER = "bedrock";

// TODO: Cohere need a different input to nova, need to check others as well.
export const bedrockModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("nova-lite", PROVIDER, {
    name: "Amazon Nova Lite",
    matchingModel: "amazon.nova-lite-v1:0",
    description:
      "Amazon Nova Lite is a very low-cost multimodal model that is lightning fast for processing image, video, and text inputs. Amazon Nova Lite's accuracy across a breadth of tasks, coupled with its lightning-fast speed, makes it suitable for a wide range of interactive and high-volume applications where cost is a key consideration.",
    type: ["text", "image-to-text"],
    contextWindow: 300000,
    maxTokens: 5000,
    costPer1kInputTokens: 0.0008,
    costPer1kOutputTokens: 0.0016,
    strengths: ["analysis", "multilingual", "vision"],
    contextComplexity: 3,
    reliability: 3,
    speed: 4,
    multimodal: true,
    includedInRouter: true,
    supportsDocuments: true,
  }),

  createModelConfig("nova-micro", PROVIDER, {
    name: "Amazon Nova Micro",
    matchingModel: "amazon.nova-micro-v1:0",
    description:
      "Amazon Nova Micro is a text only model that delivers the lowest latency responses at very low cost. It is highly performant at language understanding, translation, reasoning, code completion, brainstorming, and mathematical problem-solving. With its generation speed of over 200 tokens per second, Amazon Nova Micro is ideal for applications that require fast responses.",
    type: ["text", "coding"],
    contextWindow: 128000,
    maxTokens: 5000,
    costPer1kInputTokens: 0.0001,
    costPer1kOutputTokens: 0.0002,
    strengths: ["coding", "analysis", "multilingual"],
    contextComplexity: 2,
    reliability: 3,
    speed: 5,
    multimodal: false,
    includedInRouter: true,
  }),

  createModelConfig("nova-pro", PROVIDER, {
    name: "Amazon Nova Pro",
    matchingModel: "amazon.nova-pro-v1:0",
    description:
      "Amazon Nova Pro is a highly capable multimodal model with the best combination of accuracy, speed, and cost for a wide range of tasks.  Amazon Nova Pro's capabilities, coupled with its industry-leading speed and cost efficiency, makes it a compelling model for almost any task, including video summarization, Q&A, mathematical reasoning, software development, and AI agents that can execute multi-step workflows.",
    type: ["text", "image-to-text"],
    contextWindow: 300000,
    maxTokens: 5000,
    costPer1kInputTokens: 0.0015,
    costPer1kOutputTokens: 0.006,
    strengths: ["coding", "analysis", "math", "reasoning", "vision"],
    contextComplexity: 4,
    reliability: 4,
    speed: 3,
    multimodal: true,
    supportsDocuments: true,
  }),

  createModelConfig("nova-canvas", PROVIDER, {
    name: "Amazon Nova Canvas",
    matchingModel: "amazon.nova-canvas-v1:0",
    description:
      "Amazon Nova Canvas is a state-of-the-art image generation model that creates professional grade images from text or images provided in prompts. Amazon Nova Canvas also provides features that make it easy to edit images using text inputs, controls for adjusting color scheme and layout, and built-in controls to support safe and responsible use of AI.",
    type: ["text-to-image", "image-to-image"],
    beta: true,
    costPer1kInputTokens: 0.002,
    contextWindow: 1024,
    maxTokens: 1024,
    multimodal: true,
  }),

  createModelConfig("nova-reel", PROVIDER, {
    name: "Amazon Nova Reel",
    matchingModel: "amazon.nova-reel-v1:0",
    description:
      "Amazon Nova Reel is a state-of-the-art video generation model that allows customers to easily create high quality video from text and images. Amazon Nova Reel supports use of natural language prompts to control visual style and pacing, including camera motion control, and built-in controls to support safe and responsible use of AI.",
    type: ["text-to-video", "image-to-video"],
    beta: true,
    contextWindow: 512,
    maxTokens: 512,
    multimodal: true,
  }),

  createModelConfig("embed-english", PROVIDER, {
    name: "Cohere Embed English",
    matchingModel: "cohere.embed-english-v3",
    type: ["embedding"],
    costPer1kInputTokens: 0.0001,
  }),

  createModelConfig("embed-multilingual", PROVIDER, {
    name: "Cohere Embed Multilingual",
    matchingModel: "cohere.embed-multilingual-v3",
    type: ["embedding"],
    costPer1kInputTokens: 0.0001,
  }),

  createModelConfig("command-r", PROVIDER, {
    name: "Cohere Command R",
    matchingModel: "cohere.command-r-v1:0",
    description:
      "Command R is an instruction-following conversational model that performs language tasks at a higher quality, more reliably, and with a longer context than previous models. It can be used for complex workflows like code generation, retrieval augmented generation (RAG), tool use, and agents.",
    type: ["text"],
    contextWindow: 128000,
    maxTokens: 4096,
    costPer1kInputTokens: 0.0005,
    costPer1kOutputTokens: 0.0015,
    strengths: ["summarization", "analysis"],
    contextComplexity: 3,
    reliability: 3,
    speed: 3,
  }),

  createModelConfig("command-r-plus", PROVIDER, {
    name: "Cohere Command R+",
    matchingModel: "cohere.command-r-plus-v1:0",
    description:
      "Command R+ is an instruction-following conversational model that performs language tasks at a higher quality, more reliably, and with a longer context than previous models. It is best suited for complex RAG workflows and multi-step tool use.",
    type: ["text"],
    contextWindow: 128000,
    maxTokens: 4096,
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    strengths: ["summarization", "analysis", "reasoning"],
    contextComplexity: 4,
    reliability: 4,
    speed: 2,
  }),

  createModelConfig("titan-image-generator", PROVIDER, {
    name: "Amazon Titan Image Generator",
    matchingModel: "amazon.titan-image-generator-v1",
    type: ["text-to-image", "image-to-image"],
    beta: true,
  }),

  createModelConfig("titan-multimodal-embeddings", PROVIDER, {
    name: "Amazon Titan Multimodal Embeddings",
    matchingModel: "amazon.titan-embed-image-v1",
    type: ["embedding"],
    multimodal: true,
  }),

  createModelConfig("titan-text-embeddings", PROVIDER, {
    name: "Amazon Titan Text Embeddings",
    matchingModel: "amazon.titan-embed-text-v2:0",
    type: ["embedding"],
  }),

  createModelConfig("titan-text-express", PROVIDER, {
    name: "Amazon Titan Text Express",
    matchingModel: "amazon.titan-text-express-v1",
    description: "LLM offering a balance of price and performance.",
    type: ["text", "coding", "instruct"],
    contextWindow: 32000,
    maxTokens: 8000,
    costPer1kInputTokens: 0.0003,
    costPer1kOutputTokens: 0.0004,
    strengths: ["coding", "analysis"],
    contextComplexity: 3,
    reliability: 3,
    speed: 3,
  }),

  createModelConfig("titan-text-lite", PROVIDER, {
    name: "Amazon Titan Text Lite",
    matchingModel: "amazon.titan-text-lite-v1",
    description:
      "Cost-effective and highly customizable LLM. Right-sized for specific use cases, ideal for text generation tasks and fine-tuning.",
    type: ["text", "coding"],
    contextWindow: 4000,
    maxTokens: 4000,
    costPer1kInputTokens: 0.00003,
    costPer1kOutputTokens: 0.00004,
    strengths: ["coding"],
    contextComplexity: 2,
    reliability: 2,
    speed: 4,
  }),

  createModelConfig("titan-text-premier", PROVIDER, {
    name: "Amazon Titan Text Premier",
    matchingModel: "amazon.titan-text-premier-v1:0",
    description:
      "Amazon Titan Text Premier is a powerful and advanced large language model (LLM) within the Amazon Titan Text family, designed to deliver superior performance across a wide range of enterprise applications. ",
    type: ["text", "coding"],
    contextWindow: 32000,
    maxTokens: 8000,
    costPer1kInputTokens: 0.0013,
    costPer1kOutputTokens: 0.0017,
    strengths: ["coding", "analysis", "reasoning"],
    contextComplexity: 4,
    reliability: 4,
    speed: 3,
  }),

  createModelConfig("jamba-large", PROVIDER, {
    name: "AI21 Jamba 1.5 Large",
    matchingModel: "ai21.jamba-1-5-large-v1:0",
    description:
      "Jamba 1.5 Large (94B active/398B total) is built for superior long context handling, speed, and quality. They mark the first time a non-Transformer model has been successfully scaled to the quality and strength of the market's leading models.",
    type: ["text", "instruct"],
    contextWindow: 128000,
    maxTokens: 8000,
    costPer1kInputTokens: 0.002,
    costPer1kOutputTokens: 0.008,
    strengths: ["analysis", "reasoning"],
    contextComplexity: 4,
    reliability: 4,
    speed: 3,
  }),

  createModelConfig("jamba-mini", PROVIDER, {
    name: "AI21 Jamba 1.5 Mini",
    matchingModel: "ai21.jamba-1-5-mini-v1:0",
    description:
      "Jamba 1.5 Mini (12B active/52B total) is built for superior long context handling, speed, and quality. They mark the first time a non-Transformer model has been successfully scaled to the quality and strength of the market's leading models.",
    type: ["text", "instruct"],
    contextWindow: 128000,
    maxTokens: 8000,
    costPer1kInputTokens: 0.0002,
    costPer1kOutputTokens: 0.0004,
    strengths: ["analysis"],
    contextComplexity: 3,
    reliability: 3,
    speed: 4,
  }),

  createModelConfig("jambda-instruct", PROVIDER, {
    name: "AI21 Jambda Instruct",
    matchingModel: "ai21.jamba-instruct-v1:0",
    description:
      "Jambda Instruct is an aligned version of Jamba with additional training, chat capabilities, and safety guardrails to make it suitable for immediate and secure enterprise use.",
    type: ["text", "instruct"],
    contextWindow: 128000,
    maxTokens: 8000,
    costPer1kInputTokens: 0.0005,
    costPer1kOutputTokens: 0.0007,
    strengths: ["summarization", "analysis"],
    contextComplexity: 3,
    reliability: 4,
    speed: 3,
  }),
]);

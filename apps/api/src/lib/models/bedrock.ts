import type { ModelConfig } from "../../types";

// TODO: Cohere need a different input to nova, need to check others as well.
export const bedrockModelConfig: ModelConfig = {
  "nova-lite": {
    name: "Amazon Nova Lite",
    matchingModel: "amazon.nova-lite-v1:0",
    description:
      "Amazon Nova Lite is a very low-cost multimodal model that is lightning fast for processing image, video, and text inputs. Amazon Nova Lite's accuracy across a breadth of tasks, coupled with its lightning-fast speed, makes it suitable for a wide range of interactive and high-volume applications where cost is a key consideration.",
    provider: "bedrock",
    type: ["text"],
  },
  "nova-micro": {
    name: "Amazon Nova Micro",
    matchingModel: "amazon.nova-micro-v1:0",
    description:
      "Amazon Nova Micro is a text only model that delivers the lowest latency responses at very low cost. It is highly performant at language understanding, translation, reasoning, code completion, brainstorming, and mathematical problem-solving. With its generation speed of over 200 tokens per second, Amazon Nova Micro is ideal for applications that require fast responses.",
    provider: "bedrock",
    type: ["text"],
  },
  "nova-pro": {
    name: "Amazon Nova Pro",
    matchingModel: "amazon.nova-pro-v1:0",
    description:
      "Amazon Nova Pro is a highly capable multimodal model with the best combination of accuracy, speed, and cost for a wide range of tasks.  Amazon Nova Pro's capabilities, coupled with its industry-leading speed and cost efficiency, makes it a compelling model for almost any task, including video summarization, Q&A, mathematical reasoning, software development, and AI agents that can execute multi-step workflows.",
    provider: "bedrock",
    type: ["text"],
  },
  "nova-canvas": {
    name: "Amazon Nova Canvas",
    matchingModel: "amazon.nova-canvas-v1:0",
    description:
      "Amazon Nova Canvas is a state-of-the-art image generation model that creates professional grade images from text or images provided in prompts. Amazon Nova Canvas also provides features that make it easy to edit images using text inputs, controls for adjusting color scheme and layout, and built-in controls to support safe and responsible use of AI.",
    provider: "bedrock",
    type: ["image-to-image"],
    beta: true,
  },
  "nova-reel": {
    name: "Amazon Nova Reel",
    matchingModel: "amazon.nova-reel-v1:0",
    description:
      "Amazon Nova Reel is a state-of-the-art video generation model that allows customers to easily create high quality video from text and images. Amazon Nova Reel supports use of natural language prompts to control visual style and pacing, including camera motion control, and built-in controls to support safe and responsible use of AI.",
    provider: "bedrock",
    type: ["text-to-video", "image-to-video"],
    beta: true,
  },
  "embed-english": {
    name: "Cohere Embed English",
    matchingModel: "cohere.embed-english-v3",
    provider: "bedrock",
    type: ["embedding"],
  },
  "embed-multilingual": {
    name: "Cohere Embed Multilingual",
    matchingModel: "cohere.embed-multilingual-v3",
    provider: "bedrock",
    type: ["embedding"],
  },
  command: {
    name: "Cohere Command",
    matchingModel: "cohere.command-text-v14",
    description:
      "An instruction-following conversational model that performs language tasks with high quality, more reliably and with a longer context than our base generative models.",
    provider: "bedrock",
    type: ["text", "instruct"],
  },
  "command-light": {
    name: "Cohere Command Light",
    matchingModel: "cohere.command-light-text-v14",
    description:
      "A smaller, faster version of command. Almost as capable, but a lot faster.",
    provider: "bedrock",
    type: ["text", "instruct"],
  },
  "command-r": {
    name: "Cohere Command R",
    matchingModel: "cohere.command-r-v1:0",
    description:
      "command-r-03-2024	Command R is an instruction-following conversational model that performs language tasks at a higher quality, more reliably, and with a longer context than previous models. It can be used for complex workflows like code generation, retrieval augmented generation (RAG), tool use, and agents.",
    provider: "bedrock",
    strengths: ["summarization"],
    type: ["text"],
  },
  "command-r-plus": {
    name: "Cohere Command R+",
    matchingModel: "cohere.command-r-plus-v1:0",
    description:
      "Command R+ is an instruction-following conversational model that performs language tasks at a higher quality, more reliably, and with a longer context than previous models. It is best suited for complex RAG workflows and multi-step tool use.",
    provider: "bedrock",
    strengths: ["summarization"],
    type: ["text"],
  },
  "titan-image-generator": {
    name: "Amazon Titan Image Generator",
    matchingModel: "amazon.titan-image-generator-v1",
    provider: "bedrock",
    type: ["text-to-image", "image-to-image"],
    beta: true,
  },
  "titan-multimodal-embeddings": {
    name: "Amazon Titan Multimodal Embeddings",
    matchingModel: "amazon.titan-embed-image-v1",
    provider: "bedrock",
    type: ["embedding"],
  },
  "titan-text-embeddings": {
    name: "Amazon Titan Text Embeddings",
    matchingModel: "amazon.titan-embed-text-v2:0",
    provider: "bedrock",
    type: ["embedding"],
  },
  "titan-text-express": {
    name: "Amazon Titan Text Express",
    matchingModel: "amazon.titan-text-express-v1",
    description: "LLM offering a balance of price and performance.",
    provider: "bedrock",
    type: ["text", "coding", "instruct"],
  },
  "titan-text-lite": {
    name: "Amazon Titan Text Lite",
    matchingModel: "amazon.titan-text-lite-v1",
    description:
      "Cost-effective and highly customizable LLM. Right-sized for specific use cases, ideal for text generation tasks and fine-tuning.",
    provider: "bedrock",
    type: ["text", "coding"],
  },
  "titan-text-premier": {
    name: "Amazon Titan Text Premier",
    matchingModel: "amazon.titan-text-premier-v1:0",
    description:
      "Amazon Titan Text Premier is a powerful and advanced large language model (LLM) within the Amazon Titan Text family, designed to deliver superior performance across a wide range of enterprise applications. ",
    provider: "bedrock",
    type: ["text", "coding"],
  },
  "jamba-large": {
    name: "AI21 Jamba 1.5 Large",
    matchingModel: "ai21.jamba-1-5-large-v1:0",
    description:
      "Jamba 1.5 Large (94B active/398B total) is built for superior long context handling, speed, and quality. They mark the first time a non-Transformer model has been successfully scaled to the quality and strength of the market's leading models.",
    provider: "bedrock",
    type: ["text", "instruct"],
  },
  "jamba-mini": {
    name: "AI21 Jamba 1.5 Mini",
    matchingModel: "ai21.jamba-1-5-mini-v1:0",
    description:
      "Jamba 1.5 Mini (12B active/52B total) is built for superior long context handling, speed, and quality. They mark the first time a non-Transformer model has been successfully scaled to the quality and strength of the market's leading models.",
    provider: "bedrock",
    type: ["text", "instruct"],
  },
  "jambda-instruct": {
    name: "AI21 Jambda Instruct",
    matchingModel: "ai21.jamba-instruct-v1:0",
    description:
      "Jambda Instruct is an aligned version of Jamba with additional training, chat capabilities, and safety guardrails to make it suitable for immediate and secure enterprise use.",
    provider: "bedrock",
    strengths: ["summarization"],
    type: ["text", "instruct"],
  },
};

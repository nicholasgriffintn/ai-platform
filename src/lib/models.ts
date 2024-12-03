import type { Model, ModelConfig } from '../types';

const modelConfig: ModelConfig = {
	'claude-3-5-sonnet': {
		matchingModel: 'claude-3-5-sonnet-20241022',
		provider: 'anthropic',
		type: 'text',
	},
	'claude-3.5-haiku': {
		matchingModel: 'claude-3-5-haiku-20241022',
		provider: 'anthropic',
		type: 'text',
	},
	'claude-3.5-opus': {
		matchingModel: 'claude-3.5-opus-20240229',
		provider: 'anthropic',
		type: 'text',
	},
	'llama-3.2-1b-instruct': {
		matchingModel: '@cf/meta/llama-3.2-1b-instruct',
		provider: 'cloudflare',
		type: 'text',
	},
	'llama-3.2-3b-instruct': {
		matchingModel: '@cf/meta/llama-3.2-3b-instruct',
		provider: 'cloudflare',
		type: 'text',
	},
	'llama-3.1-70b-instruct': {
		matchingModel: '@cf/meta/llama-3.1-70b-instruct',
		provider: 'cloudflare',
		type: 'text',
	},
	'hermes-2-pro-mistral-7b': {
		matchingModel: '@hf/nousresearch/hermes-2-pro-mistral-7b',
		provider: 'cloudflare',
		type: 'text',
	},
	llava: {
		matchingModel: '@cf/llava-hf/llava-1.5-7b-hf',
		provider: 'cloudflare',
		type: 'image-to-text',
	},
	grok: {
		matchingModel: 'grok-beta',
		provider: 'grok',
		type: 'text',
	},
	'smollm2-1.7b-instruct': {
		matchingModel: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',
		provider: 'huggingface',
		type: 'text',
	},
	'llama-3.1-sonar-small-128k-online': {
		matchingModel: 'llama-3.1-sonar-small-128k-online',
		provider: 'perplexity-ai',
		type: 'text',
	},
	'llama-3.1-sonar-large-128k-online': {
		matchingModel: 'llama-3.1-sonar-large-128k-online',
		provider: 'perplexity-ai',
		type: 'text',
	},
	'llama-3.1-sonar-huge-128k-online': {
		matchingModel: 'llama-3.1-sonar-huge-128k-online',
		provider: 'perplexity-ai',
		type: 'text',
	},
	flux: {
		matchingModel: '@cf/black-forest-labs/flux-1-schnell',
		provider: 'cloudflare',
		type: 'text',
	},
	'stable-diffusion-1.5-img2img': {
		matchingModel: '@cf/runwayml/stable-diffusion-v1-5-img2img',
		provider: 'cloudflare',
		type: 'image-to-image',
	},
	'stable-diffusion-1.5-inpainting': {
		matchingModel: '@cf/runwayml/stable-diffusion-v1-5-inpainting',
		provider: 'cloudflare',
		type: 'image-to-image',
	},
	'stable-diffusion-xl-base-1.0': {
		matchingModel: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
		provider: 'cloudflare',
		type: 'text-to-image',
	},
	'stable-diffusion-xl-lightning': {
		matchingModel: '@cf/bytedance/stable-diffusion-xl-lightning',
		provider: 'cloudflare',
		type: 'text-to-image',
	},
	whisper: {
		matchingModel: '@cf/openai/whisper',
		provider: 'cloudflare',
		type: 'speech',
	},
	openchat: {
		matchingModel: '@cf/openchat/openchat-3.5-0106',
		provider: 'cloudflare',
		type: 'text',
	},
	'phi-2': {
		matchingModel: '@cf/microsoft/phi-2',
		provider: 'cloudflare',
		type: 'text',
	},
	sqlcoder: {
		matchingModel: '@cf/defog/sqlcoder-7b-2',
		provider: 'cloudflare',
		type: 'coding',
	},
	tinyllama: {
		matchingModel: '@cf/tinyllama/tinyllama-1.1b-chat-v1.0',
		provider: 'cloudflare',
		type: 'text',
	},
	'una-cybertron-7b-v2': {
		matchingModel: '@cf/fblgit/una-cybertron-7b-v2-bf16',
		provider: 'cloudflare',
		type: 'text',
	},
	'deepseek-coder-6.7b': {
		matchingModel: '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
		provider: 'cloudflare',
		type: 'coding',
	},
	'pixtral-large': {
		matchingModel: 'pixtral-large-latest',
		provider: 'mistral',
		type: 'image-to-text',
	},
	codestral: {
		matchingModel: 'codestral-latest',
		provider: 'mistral',
		type: 'coding',
	},
	'mistral-large': {
		matchingModel: 'mistral-large-latest',
		provider: 'mistral',
		type: 'text',
	},
	'mistral-small': {
		matchingModel: 'mistral-small-latest',
		provider: 'mistral',
		type: 'text',
	},
	'mistral-nemo': {
		matchingModel: 'open-mistral-nemo',
		provider: 'mistral',
		type: 'text',
	},
	'gemini-experimental': {
		matchingModel: 'google/gemini-exp-1121:free',
		provider: 'openrouter',
		type: 'text',
	},
	'embed-english': {
		matchingModel: 'cohere.embed-english-v3',
		provider: 'bedrock',
		type: 'embedding',
	},
	'embed-multilingual': {
		matchingModel: 'cohere.embed-multilingual-v3',
		provider: 'bedrock',
		type: 'embedding',
	},
	command: {
		matchingModel: 'cohere.command-text-v14',
		provider: 'bedrock',
		type: ['text', 'instruct'],
	},
	'command-light': {
		matchingModel: 'cohere.command-light-text-v14',
		provider: 'bedrock',
		type: ['text', 'instruct'],
	},
	'command-r': {
		matchingModel: 'cohere.command-r-v1:0',
		provider: 'bedrock',
		type: ['nlp', 'text', 'summarization'],
	},
	'command-r-plus': {
		matchingModel: 'cohere.command-r-plus-v1:0',
		provider: 'bedrock',
		type: ['nlp', 'text', 'summarization'],
	},
	'titan-image-generator': {
		matchingModel: 'amazon.titan-image-generator-v1',
		provider: 'bedrock',
		type: ['text-to-image', 'image-to-image'],
	},
	'titan-multimodal-embeddings': {
		matchingModel: 'amazon.titan-embed-image-v1',
		provider: 'bedrock',
		type: 'embedding',
	},
	'titan-text-embeddings': {
		matchingModel: 'amazon.titan-embed-text-v2:0',
		provider: 'bedrock',
		type: 'embedding',
	},
	'titan-text-express': {
		matchingModel: 'amazon.titan-text-express-v1',
		provider: 'bedrock',
		type: ['text', 'coding', 'instruct'],
	},
	'titan-text-lite': {
		matchingModel: 'amazon.titan-text-lite-v1',
		provider: 'bedrock',
		type: ['text', 'coding'],
	},
	'nova-canvas': {
		matchingModel: 'amazon.nova-canvas-v1:0',
		provider: 'bedrock',
		type: ['image-to-image'],
	},
	'nova-lite': {
		matchingModel: 'amazon.nova-lite-v1:0',
		provider: 'bedrock',
		type: ['text', 'image-to-text', 'video-to-text'],
	},
	'nova-micro': {
		matchingModel: 'amazon.nova-micro-v1:0',
		provider: 'bedrock',
		type: ['text'],
	},
	'nova-pro': {
		matchingModel: 'amazon.nova-pro-v1:0',
		provider: 'bedrock',
		type: ['text', 'image-to-text', 'video-to-text'],
	},
	'nova-reel': {
		matchingModel: 'amazon.nova-reel-v1:0',
		provider: 'bedrock',
		type: ['text-to-video', 'image-to-video'],
	},
	'jamba-large': {
		matchingModel: 'ai21.jamba-1-5-large-v1:0',
		provider: 'bedrock',
		type: ['text', 'instruct'],
	},
	'jamba-mini': {
		matchingModel: 'ai21.jamba-1-5-mini-v1:0',
		provider: 'bedrock',
		type: ['text', 'instruct'],
	},
	'jambda-instruct': {
		matchingModel: 'ai21.jamba-instruct-v1:0',
		provider: 'bedrock',
		type: ['text', 'instruct', 'summarization'],
	},
	qwen: {
		matchingModel: 'qwen/qwq-32b-preview',
		provider: 'openrouter',
		type: 'text',
	},
};

export function getModelConfig(model?: Model) {
	return (model && modelConfig[model]) || modelConfig['hermes-2-pro-mistral-7b'];
}

export function getMatchingModel(model: Model = 'hermes-2-pro-mistral-7b') {
	return model && getModelConfig(model).matchingModel;
}

export function getModelConfigByMatchingModel(matchingModel: string) {
	for (const model in modelConfig) {
		if (modelConfig[model as keyof typeof modelConfig].matchingModel === matchingModel) {
			return modelConfig[model as keyof typeof modelConfig];
		}
	}
	return null;
}

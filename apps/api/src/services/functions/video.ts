import type { IFunction, IRequest } from "../../types";
import {
	generateVideo,
	type VideoGenerationParams,
	type VideoResponse,
} from "../apps/generate-video";

const DEFAULT_HEIGHT = 320;
const DEFAULT_WIDTH = 576;
const MAX_DIMENSION = 1280;
const DEFAULT_FRAMES = 24;
const DEFAULT_GUIDANCE_SCALE = 6;
const MIN_GUIDANCE_SCALE = 1;
const DEFAULT_INFER_STEPS = 50;
const MIN_INFER_STEPS = 1;
const DEFAULT_FLOW_SHIFT = 7;

export const create_video: IFunction = {
	name: "create_video",
	description:
		"Generate a video from a prompt using Replicate, only use this if the user has explicitly asked to create a video",
	parameters: {
		type: "object",
		properties: {
			prompt: {
				type: "string",
				description: "the main prompt that should be passed in to the LLM",
			},
			negative_prompt: {
				type: "string",
				description: "the negative prompt that should be passed in to the LLM",
			},
			embedded_guidance_scale: {
				type: "integer",
				description: `Scale for classifier-free guidance. Must be greater than or equal to ${MIN_GUIDANCE_SCALE} and no greater than ${DEFAULT_GUIDANCE_SCALE} Defaults to ${DEFAULT_GUIDANCE_SCALE}.`,
				default: DEFAULT_GUIDANCE_SCALE,
				minimum: MIN_GUIDANCE_SCALE,
			},
			video_length: {
				type: "integer",
				description: `The length of the video in frames. Defaults to ${DEFAULT_FRAMES}.`,
				default: DEFAULT_FRAMES,
			},
			infer_steps: {
				type: "integer",
				description: `The number of inference steps to take. Must be greater than or equal to ${MIN_INFER_STEPS}. Defaults to ${DEFAULT_INFER_STEPS}.`,
				default: DEFAULT_INFER_STEPS,
			},
			seed: {
				type: "integer",
				description: "A random seed for reproducibility.",
			},
			flow_shift: {
				type: "integer",
				description: `The amount of flow shift to apply. Defaults to ${DEFAULT_FLOW_SHIFT}.`,
				default: DEFAULT_FLOW_SHIFT,
			},
			height: {
				type: "integer",
				description: `The height of the video. Defaults to ${DEFAULT_HEIGHT}, must be less than or equal to ${MAX_DIMENSION}.`,
				default: DEFAULT_HEIGHT,
				maximum: MAX_DIMENSION,
			},
			width: {
				type: "integer",
				description: `The width of the video. Defaults to ${DEFAULT_WIDTH}, must be less than or equal to ${MAX_DIMENSION}.`,
				default: DEFAULT_WIDTH,
				maximum: MAX_DIMENSION,
			},
		},
		required: ["prompt"],
	},
	function: async (
		completion_id: string,
		args: VideoGenerationParams,
		req: IRequest,
		appUrl?: string,
	): Promise<VideoResponse> => {
		const response = await generateVideo({
			completion_id,
			appUrl,
			env: req.env,
			args,
		});

		return response;
	},
};

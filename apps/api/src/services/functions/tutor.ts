import type { IFunction, IRequest, SearchOptions } from "../../types";
import { completeTutorRequest } from "../apps/tutor";

export const tutor: IFunction = {
	name: "tutor",
	description:
		"Given a topic that the user wants to learn about, provide an interactive learning experience.",
	parameters: {
		type: "object",
		properties: {
			topic: {
				type: "string",
				description: "The topic that the user wants to learn about",
			},
			level: {
				type: "string",
				description: "The level of the learning experience",
				default: "advanced",
			},
		},
		required: ["topic"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
	) => {
		const { topic, level } = args;
		const options: SearchOptions = {
			search_depth: "basic",
			include_answer: false,
			include_raw_content: false,
			include_images: false,
		};

		const {
			answer,
			sources,
			completion_id: tutor_completion_id,
		} = await completeTutorRequest(req.env, req.user, {
			topic,
			level,
			options,
			completion_id,
		});

		return {
			name: "tutor",
			status: "success",
			content: "Tutor request completed",
			data: { answer, sources, completion_id: tutor_completion_id },
		};
	},
};

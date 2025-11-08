import { getChatProvider } from "~/lib/providers/capabilities/chat";
import type { IFunction, IRequest } from "~/types";

export const v0_code_generation: IFunction = {
	name: "v0_code_generation",
	description:
		"Generate code for a web application using the v0 AI model, which is specifically designed for creating frontend and fullstack apps using frameworks like Next.JS.",
	parameters: {
		type: "object",
		properties: {
			prompt: {
				type: "string",
				description: "A prompt describing what code you want to generate.",
			},
			system_prompt: {
				type: "string",
				description: "A system prompt to guide the AI's behavior.",
			},
			image_base_64: {
				type: "string",
				description:
					"An image to include in the prompt for a multimodal input.",
			},
		},
		required: ["prompt"],
	},
	type: "premium",
	costPerCall: 0,
	function: async (
		_completion_id: string,
		args: any,
		req: IRequest,
		_app_url?: string,
	) => {
		if (!args.prompt) {
			return {
				status: "error",
				name: "v0_code_generation",
				content: "Missing prompt",
				data: {},
			};
		}

		const messages = [];

		if (args.system_prompt) {
			messages.push({
				role: "system",
				content: args.system_prompt,
			});
		}

		if (args.image_base_64) {
			messages.push({
				role: "user",
				content: [
					{ type: "text", text: args.prompt },
					{
						type: "image_url",
						image_url: {
							url: `data:image/jpeg;base64,${args.image_base_64}`,
						},
					},
				],
			});
		} else {
			messages.push({
				role: "user",
				content: args.prompt,
			});
		}

		const provider = getChatProvider("v0", { env: req.env, user: req.user });
		const response = await provider.getResponse(
			{
				model: "v0-1.0-md",
				env: req.env,
				user: req.user,
				messages,
			},
			req.user?.id,
		);

		if (!response.data) {
			return {
				status: "error",
				name: "v0_code_generation",
				content: "Error generating code",
				data: {},
			};
		}

		return {
			status: "success",
			name: "v0_code_generation",
			content: "Code generated successfully",
			data: response.data,
		};
	},
};

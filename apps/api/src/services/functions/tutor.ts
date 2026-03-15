import type { ConversationManager } from "~/lib/conversationManager";
import { completeTutorRequest } from "~/services/apps/tutor";
import type { IRequest, SearchOptions } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

export const tutor: ApiToolDefinition = {
	name: "tutor",
	description:
		"Provides structured, interactive learning experiences on requested topics. Use when users express a desire to learn about a subject or develop skills. Creates personalized learning paths with explanations, examples, exercises, and adaptive feedback based on user responses.",
	isDefault: true,
	inputSchema: jsonSchemaToZod({
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
	}),
	type: "normal",
	costPerCall: 1,
	execute: async (args, context) => {
		const req = context.request;
		const completion_id = context.completionId;
		const conversationManager = context.conversationManager;

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
		} = await completeTutorRequest(
			req.env,
			req.user,
			{
				topic,
				level,
				options,
				completion_id,
			},
			conversationManager,
		);

		return {
			name: "tutor",
			status: "success",
			content: "Tutor request completed",
			data: { answer, sources, completion_id: tutor_completion_id },
		};
	},
};

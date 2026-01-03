import type { ModelConfig, Message } from "~/types";

export function getModelIdsByOutput(
	config: ModelConfig,
	provider: string,
	modality: "image" | "audio" | "video" | "speech",
) {
	return Object.entries(config)
		.filter(
			([, model]) =>
				model.provider === provider &&
				(model.modalities?.output ?? []).includes(modality),
		)
		.map(([id]) => id);
}

export function extractPromptFromMessages(messages: Message[]): string {
	return messages
		.map((message) => {
			const role = message.role;
			let content = "";

			if (typeof message.content === "string") {
				content = message.content;
			} else if (Array.isArray(message.content)) {
				content = message.content
					.map((c) => {
						if (c.type === "text") return c.text;
						return "";
					})
					.join("");
			}

			return `${role}: ${content}`;
		})
		.join("\n");
}

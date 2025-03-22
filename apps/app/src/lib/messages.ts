import type { Message } from "~/types";

export function normalizeMessage(message: Message): Message {
	let content = message.content;
	const reasoning = message.reasoning;
	let newReasoning = null;

	if (typeof content === "string") {
		const formatted = formatMessageContent(content);
		content = formatted.content;

		if (formatted.reasoning && !reasoning) {
			newReasoning = formatted.reasoning;
		}

		const formattedContent = formattedMessageContent(content as string);
		content = formattedContent.content;
	} else if (
		content &&
		!Array.isArray(content) &&
		typeof content === "object"
	) {
		content = JSON.stringify(content);
	}

	const now = Date.now();

	const finalReasoning = newReasoning
		? {
				collapsed: true,
				content: newReasoning,
			}
		: reasoning;

	return {
		...message,
		role: message.role,
		content: content,
		id: message.id || crypto.randomUUID(),
		created: message.created || message.timestamp || now,
		timestamp: message.timestamp || message.created || now,
		model: message.model || "",
		citations: message.citations || null,
		reasoning: finalReasoning,
		log_id: message.log_id,
		tool_calls: message.tool_calls,
		usage: message.usage,
		data: message.data,
		status: message.status,
	};
}

export function formatMessageContent(messageContent: string): {
	content: string;
	reasoning: string;
} {
	let reasoning = "";
	const analysisMatch = messageContent.match(/<analysis>(.*?)<\/analysis>/s);
	const thinkMatch = messageContent.match(/<think>(.*?)<\/think>/s);

	if (analysisMatch) {
		reasoning = analysisMatch[1].trim();
	}

	if (thinkMatch) {
		reasoning = thinkMatch[1].trim();
	}

	let cleanedContent = messageContent;

	cleanedContent = cleanedContent.replace(/<analysis>.*?<\/analysis>/gs, "");
	cleanedContent = cleanedContent.replace(/<think>.*?<\/think>/gs, "");

	const answerRegex = /<answer>([\s\S]*?)(<\/answer>|$)/g;
	let match = answerRegex.exec(cleanedContent);
	while (match !== null) {
		const fullMatch = match[0];
		const contentOnly = match[1];
		cleanedContent = cleanedContent.replace(fullMatch, contentOnly);
		match = answerRegex.exec(cleanedContent);
	}

	cleanedContent = cleanedContent
		.replace(/<answer>/g, "")
		.replace(/<\/answer>/g, "")
		.trim();

	return {
		content: cleanedContent,
		reasoning,
	};
}

export const formattedMessageContent = (originalContent: string) => {
	let content = originalContent;
	const reasoning = [];
	const artifacts = [];

	const promptAnalysisRegex =
		/<prompt_analysis>([\s\S]*?)(<\/prompt_analysis>|$)/g;
	const promptAnalysisMatch = promptAnalysisRegex.exec(content);
	let analysisContent = "";

	if (promptAnalysisMatch !== null) {
		const analysisText = promptAnalysisMatch[1].trim();
		analysisContent += `**Analysis**: \n${analysisText}\n\n`;
		content = content.replace(promptAnalysisMatch[0], "");
	}

	const revisedPromptRegex =
		/<revised_prompt>([\s\S]*?)(<\/revised_prompt>|$)/g;
	const revisedPromptMatch = revisedPromptRegex.exec(content);
	if (revisedPromptMatch !== null) {
		const revisedText = revisedPromptMatch[1].trim();
		analysisContent += `**Revised Prompt**: \n${revisedText}\n\n`;
		content = content.replace(revisedPromptMatch[0], "");
	}

	const suggestionsRegex = /<suggestions>([\s\S]*?)(<\/suggestions>|$)/g;
	const suggestionsMatch = suggestionsRegex.exec(content);
	if (suggestionsMatch !== null) {
		const suggestionsText = suggestionsMatch[1].trim();
		analysisContent += `**Suggestions**: \n${suggestionsText}\n\n`;
		content = content.replace(suggestionsMatch[0], "");
	}

	const questionsRegex = /<questions>([\s\S]*?)(<\/questions>|$)/g;
	const questionsMatch = questionsRegex.exec(content);
	if (questionsMatch !== null) {
		const questionsText = questionsMatch[1].trim();
		analysisContent += `**Questions**: \n${questionsText}\n\n`;
		content = content.replace(questionsMatch[0], "");
	}

	if (analysisContent) {
		if (content.trim()) {
			analysisContent += "---\n\n";
		}
		content = analysisContent + content;
	}

	const thinkRegex = /<think>([\s\S]*?)(<\/think>|$)/g;
	while (true) {
		const match = thinkRegex.exec(content);
		if (match === null) break;

		reasoning.push({
			type: "think",
			content: match[1].trim(),
			isOpen: !match[0].includes("</think>"),
		});
		content = content.replace(match[0], "");
	}

	const analysisRegex = /<analysis>([\s\S]*?)(<\/analysis>|$)/g;
	while (true) {
		const analysisMatch = analysisRegex.exec(content);
		if (analysisMatch === null) break;

		const isStreaming = !analysisMatch[0].includes("</analysis>");
		reasoning.push({
			type: "analysis",
			content: analysisMatch[1].trim(),
			isOpen: isStreaming,
		});
		content = content.replace(analysisMatch[0], "");
	}

	const artifactRegex = /<artifact\s+([^>]*)>([\s\S]*?)(<\/artifact>|$)/g;
	let artifactMatch = null;
	const tempContent = content;

	artifactRegex.lastIndex = 0;

	artifactMatch = artifactRegex.exec(tempContent);
	while (artifactMatch !== null) {
		const attributesStr = artifactMatch[1];
		const artifactContent = artifactMatch[2].trim();
		const isOpen = !artifactMatch[0].includes("</artifact>");

		const identifier = attributesStr.match(/identifier="([^"]*)"/)?.[1] || "";
		if (!identifier) {
			console.warn(
				"Artifact missing identifier:",
				artifactMatch[0].substring(0, 50),
			);
			continue;
		}

		const getAttributeValue = (attr: string) => {
			const regex = new RegExp(`${attr}="([^"]*)"`, "i");
			const match = attributesStr.match(regex);
			return match ? match[1] : null;
		};

		const type = getAttributeValue("type") || "";
		const language = getAttributeValue("language") || type || "text";
		const title = getAttributeValue("title") || undefined;

		artifacts.push({
			identifier,
			type,
			language,
			title,
			content: artifactContent,
			placeholder: `[[ARTIFACT:${identifier}]]`,
			isOpen: isOpen,
		});

		artifactMatch = artifactRegex.exec(tempContent);
	}

	for (const artifact of artifacts) {
		const artifactRegex = new RegExp(
			`<artifact[^>]*identifier="${artifact.identifier}"[^>]*>[\\s\\S]*?(?:</artifact>|$)`,
			"g",
		);
		content = content.replace(artifactRegex, artifact.placeholder);
	}

	const answerRegex = /<answer>([\s\S]*?)(<\/answer>|$)/g;
	while (true) {
		const answerMatch = answerRegex.exec(content);
		if (answerMatch === null) break;

		content = content.replace(answerMatch[0], answerMatch[1]);
	}

	return {
		content: content.trim(),
		reasoning,
		artifacts,
	};
};

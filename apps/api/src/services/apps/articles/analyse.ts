import { analyseArticlePrompt } from "../../../lib/prompts";
import { AIProviderFactory } from "../../../providers/factory";
import type { ChatRole, IEnv } from "../../../types";
import { extractQuotes } from "../../../utils/extract";
import { verifyQuotes } from "../../../utils/verify";

export interface Params {
	article: string;
}

export interface Response {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
}

export async function analyseArticle({
	completion_id,
	app_url,
	env,
	args,
}: {
	completion_id: string;
	app_url: string | undefined;
	env: IEnv;
	args: Params;
}): Promise<Response> {
	if (!args.article) {
		return {
			status: "error",
			name: "analyse_article",
			content: "Missing article",
			data: {},
		};
	}

	try {
		const provider = AIProviderFactory.getProvider("perplexity-ai");

		const data = await provider.getResponse({
			completion_id,
			app_url,
			model: "llama-3.1-sonar-large-128k-online",
			messages: [
				{
					role: "user" as ChatRole,
					content: analyseArticlePrompt(args.article),
				},
			],
			env: env,
		});

		const quotes = extractQuotes(data.content);
		const verifiedQuotes = verifyQuotes(args.article, quotes);

		return {
			status: "success",
			name: "analyse_article",
			content: data.content,
			data: {
				model: data.model,
				id: data.id,
				citations: data.citations,
				logId: data.logId,
				verifiedQuotes,
			},
		};
	} catch (error) {
		return {
			status: "error",
			name: "analyse_article",
			content:
				error instanceof Error ? error.message : "Failed to analyse article",
			data: {},
		};
	}
}

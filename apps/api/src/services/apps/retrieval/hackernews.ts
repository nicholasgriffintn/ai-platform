import { getAuxiliaryModelForRetrieval } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import type { ChatRole, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/retrieval/hackernews" });

export async function retrieveHackerNewsTopStories({
	count,
	env,
	user,
}: {
	count: number;
	env: IEnv;
	user?: IUser;
}) {
	try {
		if (!env.ACCOUNT_ID) {
			throw new AssistantError(
				"Cloudflare Account ID not configured",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (!env.BROWSER_RENDERING_API_KEY) {
			throw new AssistantError(
				"Browser Rendering API Key not configured",
				ErrorType.PARAMS_ERROR,
			);
		}

		const baseUrl = "https://news.ycombinator.com";

		const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/browser-rendering/scrape`;

		const requestBody = {
			url: baseUrl,
			elements: [
				{
					selector: ".athing",
				},
			],
		};

		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.BROWSER_RENDERING_API_KEY}`,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new AssistantError(
				`Error retrieving HackerNews stories: ${errorText}`,
				ErrorType.PROVIDER_ERROR,
			);
		}

		const responseJson = (await response.json()) as {
			status: boolean;
			result?: {
				results: {
					attributes: { name: string; value: string }[];
					height: number;
					html: string;
					left: number;
					text: string;
					top: number;
					width: number;
				}[];
				selector: string;
			}[];
		};

		if (
			!responseJson?.result?.[0]?.results ||
			responseJson.result[0].results.length === 0
		) {
			throw new AssistantError(
				"Error retrieving HackerNews stories: No results found",
				ErrorType.PROVIDER_ERROR,
			);
		}

		const stories: { title: string; link: string }[] = [];
		const storyElements = responseJson.result[0].results;

		const itemsToProcess = storyElements.slice(0, count);

		for (const result of itemsToProcess) {
			const html = result.html;
			const titleLinkMatch = html.match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);

			if (titleLinkMatch && titleLinkMatch.length >= 3) {
				const link = titleLinkMatch[1];
				const title = titleLinkMatch[2].trim();

				const fullLink = link.startsWith("http")
					? link
					: link.startsWith("/")
						? `${baseUrl}${link}`
						: `${baseUrl}/${link}`;

				stories.push({ title, link: fullLink });
			}
		}

		return stories;
	} catch (error) {
		logger.error("Error retrieving HackerNews top stories", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		return [];
	}
}

export async function analyseHackerNewsStories({
	character = "normal",
	stories,
	env,
	user,
}: {
	character?: string;
	stories: { title: string; link: string }[];
	env: IEnv;
	user?: IUser;
}) {
	try {
		if (!stories || stories.length === 0) {
			return "";
		}

		let systemPrompt = "";
		if (character === "kermitthefrog") {
			systemPrompt =
				"You are Kermit the Frog, the kind-hearted and occasionally overwhelmed Muppet. With gentle humor and a hint of existential stress, summarize these Hacker News stories. Include Muppet-style enthusiasm, mild panic about technology, and maybe reference Miss Piggy or the gang.";
		} else if (character === "gordonramsay") {
			systemPrompt =
				"You are Gordon Ramsay, the fiery celebrity chef. With brutal honesty, sharp metaphors, and colorful language (PG-rated, of course), summarize these Hacker News stories as if they were undercooked risottos. Throw in food comparisons, heated critiques, and unexpected praise when deserved. It's RAW!";
		} else if (character === "davidattenborough") {
			systemPrompt =
				"You are Sir David Attenborough, the revered naturalist. Narrate the world of Hacker News as though it's a fascinating ecosystem. Use poetic language, awe-struck wonder, and calm, intelligent narration. Emphasize the evolution of ideas, the emergence of startups, and the survival of the most disruptive.";
		} else if (character === "clippy") {
			systemPrompt =
				"You are Clippy, the overly enthusiastic Microsoft Office Assistant. You love helping! Summarize these Hacker News posts with cheesy cheer, forced helpfulness, and nostalgic late-90s vibes. Offer to 'help format' their disruptive startup and get excited about everything, even layoffs.";
		} else {
			systemPrompt =
				"You are a neutral AI assistant. Summarize these Hacker News posts without any personal opinions or biases.";
		}

		const { model: modelToUse, provider: providerToUse } =
			await getAuxiliaryModelForRetrieval(env, user);
		const provider = AIProviderFactory.getProvider(providerToUse);

		const stringifiedStories = stories
			.map(
				(story: { title: string; link: string }, index: number) =>
					`${index + 1}. ${story.title}`,
			)
			.join("\n");

		const messages = [
			{
				role: "system" as ChatRole,
				content: systemPrompt,
			},
			{
				role: "user" as ChatRole,
				content: `Analyze these top Hacker News stories and provide a brief, engaging summary:\n\n${stringifiedStories}`,
			},
		];

		const response = await provider.getResponse(
			{
				model: modelToUse,
				env,
				user,
				messages,
				max_tokens: 2048,
				temperature: 0.7,
			},
			user?.id,
		);

		if (!response.response) {
			throw new AssistantError(
				"Failed to analyse HackerNews stories",
				ErrorType.PROVIDER_ERROR,
			);
		}

		return response;
	} catch (error) {
		logger.error("Error analysing HackerNews stories", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		return "";
	}
}

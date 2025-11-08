import type { ChatCompletionParameters } from "~/types";
import { randomHex, randomUUIDLike } from "~/utils/id";
import { BaseProvider } from "./base";
import { AssistantError, ErrorType } from "~/utils/errors";

type CopilotTokenCache = {
	token: string;
	expiresAt?: number;
};

const copilotTokenCache = new Map<string, CopilotTokenCache>();

export class GithubCopilotProvider extends BaseProvider {
	name = "github-copilot";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	private readonly userAgent = "GitHubCopilotChat/0.8.0";
	private readonly editorPluginVersion = "copilot-chat/0.8.0";
	private readonly editorVersion = "vscode/1.83.1";
	private machineId?: string;
	private sessionId?: string;

	protected getProviderKeyName(): string {
		return "GITHUB_COPILOT_TOKEN";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(): Promise<string> {
		return "https://api.githubcopilot.com/chat/completions";
	}

	private async getCopilotBearer(
		params: ChatCompletionParameters,
	): Promise<string> {
		const userId = params.user?.id?.toString() || "anonymous";
		const now = Date.now();
		const cachedToken = copilotTokenCache.get(userId);

		if (
			cachedToken &&
			(!cachedToken.expiresAt || cachedToken.expiresAt - 60_000 > now)
		) {
			return cachedToken.token;
		}

		const hostToken = await this.getApiKey(params, params.user?.id);
		const resp = await fetch(
			"https://api.github.com/copilot_internal/v2/token",
			{
				headers: {
					Authorization: `token ${hostToken}`,
				},
			},
		);
		if (!resp.ok) {
			throw new AssistantError(
				"Failed to fetch GitHub Copilot token",
				ErrorType.PROVIDER_ERROR,
			);
		}
		const data = (await resp.json()) as { token: string; expires_at?: string };
		const expiresAt = data.expires_at ? Date.parse(data.expires_at) : undefined;
		copilotTokenCache.set(userId, { token: data.token, expiresAt });
		return data.token;
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const bearer = await this.getCopilotBearer(params);

		if (!this.machineId) {
			this.machineId = randomHex(64);
		}
		if (!this.sessionId) {
			this.sessionId = [8, 4, 4, 4, 25].map((n) => randomHex(n)).join("-");
		}

		return {
			Authorization: `Bearer ${bearer}`,
			"Content-Type": "application/json; charset=utf-8",
			"User-Agent": this.userAgent,
			Accept: "*/*",
			"Accept-Encoding": "gzip,deflate,br",
			"Openai-Intent": "conversation-panel",
			"Openai-Organization": "github-copilot",
			"Editor-Plugin-Version": this.editorPluginVersion,
			"Editor-Version": this.editorVersion,
			"Vscode-Machineid": this.machineId,
			"Vscode-Sessionid": this.sessionId,
			"X-Request-Id": randomUUIDLike(),
		};
	}
}

import type { ChatCompletionParameters } from "~/types";
import { randomHex, randomUUIDLike } from "~/utils/id";
import { BaseProvider } from "./base";

type CopilotTokenCache = {
  token: string;
  expiresAt?: number;
};

let cachedCopilotToken: CopilotTokenCache | null = null;

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

  protected getEndpoint(): string {
    return "https://api.githubcopilot.com/chat/completions";
  }

  private async getCopilotBearer(
    params: ChatCompletionParameters,
  ): Promise<string> {
    const now = Date.now();
    if (
      cachedCopilotToken &&
      (!cachedCopilotToken.expiresAt ||
        cachedCopilotToken.expiresAt - 60_000 > now)
    ) {
      return cachedCopilotToken.token;
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
      throw new Error("Failed to fetch GitHub Copilot token");
    }
    const data = (await resp.json()) as { token: string; expires_at?: string };
    const expiresAt = data.expires_at ? Date.parse(data.expires_at) : undefined;
    cachedCopilotToken = { token: data.token, expiresAt };
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

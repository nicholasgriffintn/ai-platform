import {
  createPullRequestInputSchema,
  forgePullRequestRefSchema,
  forgePullRequestSchema,
  type CreatePullRequestInput,
  type ForgePullRequest,
  type ForgePullRequestRef,
} from "@ngriffin_uk/polychat-schemas";

export interface ForgeAdapter {
  createPullRequest(input: CreatePullRequestInput): Promise<ForgePullRequest>;
  getPullRequest(ref: ForgePullRequestRef): Promise<ForgePullRequest>;
}

interface GitHubPullRequest {
  html_url?: unknown;
  number?: unknown;
  title?: unknown;
  head?: { ref?: unknown };
  base?: { ref?: unknown };
}

function repositoryPath(repository: string): string {
  const [owner, name] = repository.split("/");

  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

export function createGitHubForgeAdapter(token: string): ForgeAdapter {
  async function request(path: string, method: "GET" | "POST", body?: unknown) {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Polychat",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      ...(method === "POST" && body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    return (await response.json()) as GitHubPullRequest;
  }

  function parse(repository: string, payload: GitHubPullRequest): ForgePullRequest {
    if (
      typeof payload.html_url !== "string" ||
      typeof payload.number !== "number" ||
      typeof payload.title !== "string" ||
      typeof payload.head?.ref !== "string" ||
      typeof payload.base?.ref !== "string"
    ) {
      throw new Error("GitHub returned an incomplete pull request");
    }

    return forgePullRequestSchema.parse({
      ref: { forge: "github", repository, number: payload.number },
      url: payload.html_url,
      title: payload.title,
      head: payload.head.ref,
      base: payload.base.ref,
    });
  }

  return {
    async createPullRequest(input) {
      const request = createPullRequestInputSchema.parse(input);

      return parse(
        request.repository,
        await requestApi(repositoryPath(request.repository) + "/pulls", "POST", {
          title: request.title,
          body: request.body,
          head: request.head,
          base: request.base,
        }),
      );
    },
    async getPullRequest(ref) {
      const request = forgePullRequestRefSchema.parse(ref);

      return parse(
        request.repository,
        await requestApi(`${repositoryPath(request.repository)}/pulls/${request.number}`, "GET"),
      );
    },
  };

  async function requestApi(path: string, method: "GET" | "POST", body?: unknown) {
    return request(path, method, body);
  }
}

export function createFakeForgeAdapter(
  pullRequest: ForgePullRequest = {
    ref: { forge: "github", repository: "example/repository", number: 1 },
    url: "https://github.com/example/repository/pull/1",
    title: "Reviewed change",
    head: "polychat/run-1",
    base: "main",
  },
): ForgeAdapter {
  return {
    async createPullRequest() {
      return pullRequest;
    },
    async getPullRequest() {
      return pullRequest;
    },
  };
}

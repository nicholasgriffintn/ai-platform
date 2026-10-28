import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { githubApiRequest } from "./api-client";

const GITHUB_API_BASE = "https://api.github.com";

export const githubShaSchema = z.object({ sha: z.string().min(1) });
export const githubRefSchema = z.object({ object: githubShaSchema });
export const githubCommitSchema = z.object({ tree: githubShaSchema });
export const githubPullRequestSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.string().url(),
});

export interface GitHubRepositoryClient {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  post<T>(path: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T>;
  patch<T>(path: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T>;
  findRef(branch: string): Promise<string | null>;
}

export function createGitHubRepositoryClient(
  repository: string,
  token: string,
): GitHubRepositoryClient {
  const base = `${GITHUB_API_BASE}/repos/${repository}`;
  const send = async <T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    schema: z.ZodType<T>,
    body?: Record<string, unknown>,
  ) =>
    schema.parse(
      await (
        await githubApiRequest({ url: `${base}${path}`, method, bearerToken: token, body })
      ).json(),
    );

  return {
    get: (path, schema) => send("GET", path, schema),
    post: (path, body, schema) => send("POST", path, schema, body),
    patch: (path, body, schema) => send("PATCH", path, schema, body),
    findRef: async (branch) => {
      try {
        return (await send("GET", `/git/ref/heads/${encodeURIComponent(branch)}`, githubRefSchema))
          .object.sha;
      } catch (error) {
        if (error instanceof AssistantError && error.statusCode === 404) {
          return null;
        }

        throw error;
      }
    },
  };
}

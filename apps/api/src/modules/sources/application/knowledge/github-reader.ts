import { containsControlCharacters } from "@ngriffin_uk/polychat-utility-core";
import { withAbortTimeout } from "@ngriffin_uk/polychat-utility-server/async";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createGitHubAppJwt } from "~/infrastructure/github/app-jwt";
import {
  getGitHubAppConnectionForUserInstallation,
  getGitHubAppConnectionForUserRepo,
} from "~/modules/github/application/connections";

export const gitObjectShaSchema = z.string().regex(/^[a-f0-9]{40,64}$/);
const pathPartSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      !value.includes("/") &&
      !value.includes("\\") &&
      !containsControlCharacters(value) &&
      value !== "." &&
      value !== "..",
  );
const treeSchema = z.object({
  sha: gitObjectShaSchema,
  truncated: z.literal(false),
  tree: z
    .array(
      z.object({
        path: pathPartSchema,
        mode: z.string(),
        type: z.enum(["tree", "blob", "commit"]),
        sha: gitObjectShaSchema,
        size: z.number().int().nonnegative().optional(),
      }),
    )
    .max(10_000),
});
const commitSchema = z.object({
  sha: gitObjectShaSchema,
  commit: z.object({ tree: z.object({ sha: gitObjectShaSchema }) }),
});
const fileSchema = z.object({
  type: z.literal("file"),
  sha: gitObjectShaSchema,
  encoding: z.literal("base64"),
  content: z.string().max(400_000),
  size: z.number().int().nonnegative().max(250_000),
});

export class GitHubKnowledgeAccessError extends AssistantError {
  constructor() {
    super(
      "Connect a GitHub installation with read access to this repository",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}

export class UnsupportedKnowledgeFileError extends AssistantError {
  constructor() {
    super("Repository file is not supported text", ErrorType.PARAMS_ERROR, 422);
  }
}

async function requestGitHub<T>(
  path: string,
  token: string | undefined,
  schema: z.ZodType<T>,
  body?: object,
): Promise<T> {
  return withAbortTimeout(async (signal) => {
    const response = await fetch(new URL(path, "https://api.github.com").href, {
      method: body ? "POST" : "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "Polychat-Knowledge",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      redirect: "error",
    });

    if (
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          response.headers.has("retry-after")))
    ) {
      await response.body?.cancel();
      throw new AssistantError(
        "Repository requests are temporarily rate limited",
        ErrorType.PROVIDER_ERROR,
        503,
      );
    }

    if ([401, 403, 404].includes(response.status)) {
      await response.body?.cancel();
      throw new GitHubKnowledgeAccessError();
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new AssistantError(
        "Repository content is temporarily unavailable",
        ErrorType.PROVIDER_ERROR,
        503,
      );
    }

    const parsed = schema.safeParse(
      safeParseJson(await readResponseTextWithinLimit(response, 2_000_000)),
    );

    if (!parsed.success) {
      throw new AssistantError(
        "Repository returned incomplete or unsupported content",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return parsed.data;
  }, 10_000);
}

export async function createGitHubKnowledgeReader(
  context: ServiceContext,
  userId: number,
  repository: string,
  installationId?: number,
) {
  const connection = installationId
    ? await getGitHubAppConnectionForUserInstallation(context, userId, installationId, repository)
    : await getGitHubAppConnectionForUserRepo(context, userId, repository);
  const repoName = repository.split("/")[1];
  const token = await requestGitHub(
    `/app/installations/${connection.installationId}/access_tokens`,
    createGitHubAppJwt(connection),
    z.object({ token: z.string().min(1), permissions: z.object({ contents: z.literal("read") }) }),
    { repositories: [repoName], permissions: { contents: "read" } },
  );

  return createRepositoryReader(repository, token.token, async () => {
    await getGitHubAppConnectionForUserInstallation(
      context,
      userId,
      connection.installationId,
      repository,
    );
  });
}

export async function createPublicGitHubKnowledgeReader(repository: string) {
  await requirePublicRepository(repository);

  return createRepositoryReader(repository, undefined, async () => undefined);
}

async function requirePublicRepository(repository: string, token?: string) {
  const metadata = await requestGitHub(
    `/repos/${repository.split("/").map(encodeURIComponent).join("/")}`,
    token,
    z.object({ private: z.boolean(), full_name: z.string() }),
  );

  if (metadata.private || metadata.full_name.toLowerCase() !== repository) {
    throw new AssistantError(
      "Use personal scope for private repositories. Project conversations are shared with the whole project.",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}

function createRepositoryReader(
  repository: string,
  token: string | undefined,
  assertCurrentAccess: () => Promise<void>,
) {
  const base = `/repos/${repository.split("/").map(encodeURIComponent).join("/")}`;

  return {
    commit: (branch: string) =>
      requestGitHub(`${base}/commits/${encodeURIComponent(branch)}`, token, commitSchema),
    tree: (sha: string) =>
      requestGitHub(`${base}/git/trees/${gitObjectShaSchema.parse(sha)}`, token, treeSchema),
    file: async (path: string, ref: string) => {
      const result = await requestGitHub(
        `${base}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
        token,
        fileSchema,
      );
      let content: string;

      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(Buffer.from(result.content, "base64")),
        );
      } catch {
        throw new UnsupportedKnowledgeFileError();
      }

      if (
        content.includes("\u0000") ||
        new TextEncoder().encode(content).byteLength !== result.size
      ) {
        throw new UnsupportedKnowledgeFileError();
      }

      return { sha: result.sha, content };
    },
    assertCurrentAccess,
    assertPublic: () => requirePublicRepository(repository, token),
  };
}

export type GitHubKnowledgeReader = Awaited<ReturnType<typeof createGitHubKnowledgeReader>>;

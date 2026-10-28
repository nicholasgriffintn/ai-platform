import {
  applySitePatch,
  buildSiteImageRewritePatches,
  generateSiteFiles,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import {
  SITES_CAPABILITY_ID,
  type SitePullRequestRequest,
  type SitePullRequestResponse,
} from "@ngriffin_uk/polychat-schemas";
import { slugify } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createGitHubRepositoryClient,
  githubCommitSchema,
  githubPullRequestSchema,
  githubRefSchema,
  githubShaSchema,
  type GitHubRepositoryClient,
} from "~/infrastructure/github/repository-client";
import { resolveSandboxGitHubToken } from "~/modules/sandbox/application/github-credentials";
import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";
import { resolveProjectCodingEnvironment } from "~/modules/workspaces/application/projectCodingEnvironment";
import type { IUser } from "~/types";

import { collectSiteImageAssets } from "./images";
import { getSite } from "./records";

const PROTECTED_BRANCHES = new Set(["main", "master", "production", "release"]);

export interface OpenSitePullRequestOptions {
  context: ServiceContext;
  user: IUser;
  siteId: string;
  request: SitePullRequestRequest;
}

function normaliseDirectory(directory: string | undefined): string {
  const trimmed = (directory ?? "").replace(/^\/+|\/+$/g, "");

  if (trimmed.split("/").some((segment) => segment === "..")) {
    throw new AssistantError("Directory cannot leave the repository", ErrorType.PARAMS_ERROR, 400);
  }

  return trimmed;
}

async function resolveBranchName(client: GitHubRepositoryClient, base: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    if ((await client.findRef(candidate)) === null) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function openSitePullRequest({
  context,
  user,
  siteId,
  request,
}: OpenSitePullRequestOptions): Promise<SitePullRequestResponse> {
  await requireProjectCapabilityAccess(context, request.projectId, "app", SITES_CAPABILITY_ID);

  const { project } = await requireProjectAccess(context, request.projectId);
  const codingEnvironment = resolveProjectCodingEnvironment(project);

  if (!codingEnvironment) {
    throw new AssistantError(
      "This project has no coding environment. Connect a repository in the project settings before opening a pull request.",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  const site = await getSite({ context, userId: user.id, projectId: request.projectId }, siteId);
  const directory = normaliseDirectory(request.directory);
  const assets = await collectSiteImageAssets(context, site.project);
  const assetBySrc = new Map(assets.map((asset) => [asset.src, asset.publicPath]));
  const document = structuredClone(site.project) as unknown as Record<string, unknown>;

  for (const patch of buildSiteImageRewritePatches(
    site.project,
    (src) => assetBySrc.get(src) ?? null,
  )) {
    applySitePatch(document, patch);
  }

  const exportProject = validateSiteProject(document).project;
  const { files } = generateSiteFiles(exportProject, request.target);
  const repo = codingEnvironment.repository;
  const token = await resolveSandboxGitHubToken({
    context,
    userId: user.id,
    repo,
    installationId: codingEnvironment.installationId,
  });
  const client = createGitHubRepositoryClient(repo, token);
  const repository = await client.get("", z.object({ default_branch: z.string().min(1) }));
  const baseBranch = repository.default_branch;
  const baseRef = await client.get(
    `/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    githubRefSchema,
  );
  const baseCommit = await client.get(`/git/commits/${baseRef.object.sha}`, githubCommitSchema);
  const slug = slugify(site.project.title, 40) || "site";
  const branch = await resolveBranchName(client, `polychat/site-${slug}`);

  if (PROTECTED_BRANCHES.has(branch) || branch === baseBranch) {
    throw new AssistantError(
      "Refusing to write to a protected branch",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const prefix = (path: string) => (directory ? `${directory}/${path}` : path);
  const binaryEntries = await Promise.all(
    assets.map(async (asset) => {
      const blob = await client.post(
        "/git/blobs",
        { content: asset.content, encoding: asset.encoding },
        githubShaSchema,
      );

      return { path: prefix(asset.path), mode: "100644", type: "blob", sha: blob.sha };
    }),
  );
  const tree = await client.post(
    "/git/trees",
    {
      base_tree: baseCommit.tree.sha,
      tree: [
        ...files.map((file) => ({
          path: prefix(file.path),
          mode: "100644",
          type: "blob",
          content: file.content,
        })),
        ...binaryEntries,
      ],
    },
    githubShaSchema,
  );
  const commit = await client.post(
    "/git/commits",
    {
      message: `feat(site): add ${site.project.title} from Polychat Sites`,
      tree: tree.sha,
      parents: [baseRef.object.sha],
    },
    githubShaSchema,
  );

  await client.post("/git/refs", { ref: `refs/heads/${branch}`, sha: commit.sha }, githubRefSchema);

  const pageList = Object.values(site.project.pages)
    .map((page) => `- \`${page.path}\` ${page.title}`)
    .join("\n");
  const pullRequest = await client.post(
    "/pulls",
    {
      title: request.title ?? `Add ${site.project.title} site`,
      head: branch,
      base: baseBranch,
      body: [
        `Generated by Polychat Sites from the brief:`,
        "",
        `> ${site.brief.replace(/\n/g, "\n> ")}`,
        "",
        "Pages:",
        pageList,
        "",
        `${files.length} files${assets.length ? ` and ${assets.length} generated ${assets.length === 1 ? "image" : "images"}` : ""} under \`${directory || "/"}\` as a ${request.target} app with Tailwind CSS v4.`,
      ].join("\n"),
    },
    githubPullRequestSchema,
  );

  return {
    repo,
    branch,
    number: pullRequest.number,
    url: pullRequest.html_url,
    fileCount: files.length + assets.length,
  };
}

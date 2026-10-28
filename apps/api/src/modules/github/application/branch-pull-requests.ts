import type { AgentPullRequest, AgentPullRequestRequest } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createGitHubRepositoryClient,
  githubCommitSchema,
  githubPullRequestSchema,
  githubRefSchema,
  githubShaSchema,
} from "~/infrastructure/github/repository-client";
import { resolveSandboxGitHubToken } from "~/modules/sandbox/application/github-credentials";

const openPullRequestsSchema = z.array(githubPullRequestSchema);

export async function openBranchPullRequest(
  context: ServiceContext,
  request: AgentPullRequestRequest,
): Promise<AgentPullRequest> {
  const user = context.requireUser();
  const { changes } = request;
  const owner = changes.repository.split("/")[0];
  const token = await resolveSandboxGitHubToken({
    context,
    userId: user.id,
    repo: changes.repository,
  });
  const client = createGitHubRepositoryClient(changes.repository, token);
  const baseCommit = await client
    .get(`/git/commits/${changes.baseCommit}`, githubCommitSchema)
    .catch((error: unknown) => {
      if (error instanceof AssistantError && error.statusCode === 404) {
        throw new AssistantError(
          `This branch starts from a commit GitHub doesn't have yet. Push ${changes.baseBranch} first.`,
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      throw error;
    });
  const entries = await Promise.all(
    changes.files.map(async (file) => ({
      path: file.path,
      mode: file.executable ? "100755" : "100644",
      type: "blob",
      sha:
        file.deleted || file.contentBase64 === null
          ? null
          : (
              await client.post(
                "/git/blobs",
                { content: file.contentBase64, encoding: "base64" },
                githubShaSchema,
              )
            ).sha,
    })),
  );
  const tree = await client.post(
    "/git/trees",
    { base_tree: baseCommit.tree.sha, tree: entries },
    githubShaSchema,
  );
  const branchHead = await client.findRef(changes.branch);
  const commit = await client.post(
    "/git/commits",
    { message: request.title, tree: tree.sha, parents: [branchHead ?? changes.baseCommit] },
    githubShaSchema,
  );

  if (branchHead) {
    await client.patch(
      `/git/refs/heads/${encodeURIComponent(changes.branch)}`,
      { sha: commit.sha, force: false },
      githubRefSchema,
    );
  } else {
    await client.post(
      "/git/refs",
      { ref: `refs/heads/${changes.branch}`, sha: commit.sha },
      githubRefSchema,
    );
  }

  const [existing] = await client.get(
    `/pulls?state=open&head=${encodeURIComponent(`${owner}:${changes.branch}`)}`,
    openPullRequestsSchema,
  );
  const pullRequest =
    existing ??
    (await client.post(
      "/pulls",
      {
        title: request.title,
        head: changes.branch,
        base: changes.baseBranch,
        body: request.body,
      },
      githubPullRequestSchema,
    ));

  return {
    repository: changes.repository,
    branch: changes.branch,
    number: pullRequest.number,
    url: pullRequest.html_url,
    created: !existing,
  };
}

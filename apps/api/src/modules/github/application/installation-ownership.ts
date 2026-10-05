import { withAbortTimeout } from "@ngriffin_uk/polychat-utility-server/async";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createGitHubAppJwt } from "~/infrastructure/github/app-jwt";

const installationSchema = z.object({
  id: z.number().int().positive(),
  account: z.object({ id: z.number().int().positive(), type: z.enum(["User", "Organization"]) }),
});

export async function requireDefaultGitHubInstallationOwner(
  context: ServiceContext,
  userId: number,
  connection: { appId: string; privateKey: string; installationId: number },
) {
  const installation = await withAbortTimeout(async (signal) => {
    const response = await fetch(
      `https://api.github.com/app/installations/${connection.installationId}`,
      {
        headers: {
          Authorization: `Bearer ${createGitHubAppJwt(connection)}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "Polychat-Connections",
        },
        signal,
        redirect: "error",
      },
    );

    if (!response.ok) {
      await response.body?.cancel();
      throw new AssistantError(
        "Unable to verify GitHub installation ownership",
        ErrorType.PROVIDER_ERROR,
        503,
      );
    }

    const parsed = installationSchema.safeParse(
      safeParseJson(await readResponseTextWithinLimit(response, 32_768)),
    );

    if (!parsed.success || parsed.data.id !== connection.installationId) {
      throw new AssistantError(
        "GitHub installation could not be verified",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return parsed.data;
  }, 10_000);
  const owner = await context.repositories.users.getUserByGithubId(String(installation.account.id));

  if (installation.account.type !== "User" || owner?.id !== userId) {
    throw new AssistantError(
      "Connect an installation owned by your linked GitHub account. Organisation installations require your own GitHub App credentials.",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}

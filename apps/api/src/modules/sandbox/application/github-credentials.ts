import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getGitHubAppInstallationToken } from "~/infrastructure/github";
import {
  getGitHubAppConnectionForUserInstallation,
  getGitHubAppConnectionForUserRepo,
} from "~/modules/github/application/connections";

export async function resolveSandboxGitHubToken(params: {
  context: ServiceContext;
  userId: number;
  repo: string;
  installationId?: number;
}): Promise<string> {
  const connection = params.installationId
    ? await getGitHubAppConnectionForUserInstallation(
        params.context,
        params.userId,
        params.installationId,
        params.repo,
      )
    : await getGitHubAppConnectionForUserRepo(params.context, params.userId, params.repo);

  return getGitHubAppInstallationToken({
    appId: connection.appId,
    privateKey: connection.privateKey,
    installationId: connection.installationId,
  });
}

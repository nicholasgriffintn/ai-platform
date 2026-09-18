export interface GitHubAppEnvironment {
  GITHUB_APP_INSTALL_URL?: string;
  GITHUB_APP_SLUG?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  APP_BASE_URL?: string;
}

export function getGitHubAppInstallUrl(env: GitHubAppEnvironment): string | undefined {
  const explicitUrl = env.GITHUB_APP_INSTALL_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const appSlug = env.GITHUB_APP_SLUG?.trim();

  return appSlug ? `https://github.com/apps/${appSlug}/installations/new` : undefined;
}

export function canAutoConnectGitHubApp(env: GitHubAppEnvironment): boolean {
  return Boolean(env.GITHUB_APP_ID?.trim() && env.GITHUB_APP_PRIVATE_KEY?.trim());
}

export function getGitHubAppCallbackUrl(env: GitHubAppEnvironment): string | undefined {
  return env.APP_BASE_URL
    ? `${env.APP_BASE_URL.replace(/\/$/, "")}/profile?tab=sandbox`
    : undefined;
}

const GITHUB_PULL_REQUEST_URL =
  /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)(?:[/?#][^\s]*)?$/u;

export function parseGitHubPullRequestUrl(
  url: string,
): { repository: string; number: number; url: string } | null {
  const match = GITHUB_PULL_REQUEST_URL.exec(url.trim());
  const number = match ? Number.parseInt(match[2], 10) : Number.NaN;

  return match && Number.isSafeInteger(number) && number > 0
    ? {
        repository: match[1].toLowerCase(),
        number,
        url: `https://github.com/${match[1]}/pull/${number}`,
      }
    : null;
}

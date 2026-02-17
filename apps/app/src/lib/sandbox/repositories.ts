export const GITHUB_REPO_SLUG_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export function isGitHubRepoSlug(value: string): boolean {
	return GITHUB_REPO_SLUG_PATTERN.test(value.trim());
}

export function normaliseGitHubRepoInput(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}

	if (isGitHubRepoSlug(trimmed)) {
		return trimmed;
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(trimmed);
	} catch {
		return trimmed;
	}

	if (!["github.com", "www.github.com"].includes(parsedUrl.hostname)) {
		return trimmed;
	}

	const pathParts = parsedUrl.pathname
		.split("/")
		.map((part) => part.trim())
		.filter(Boolean);
	if (pathParts.length < 2) {
		return trimmed;
	}

	const owner = pathParts[0];
	const repo = pathParts[1].replace(/\.git$/i, "");
	const candidate = `${owner}/${repo}`;

	return isGitHubRepoSlug(candidate) ? candidate : trimmed;
}

export function parseGitHubRepositoryList(
	value: string | undefined | null,
): string[] | undefined {
	if (!value?.trim()) {
		return undefined;
	}

	const repositories = value
		.split(/[\n,]/g)
		.map((item) => normaliseGitHubRepoInput(item))
		.filter(Boolean);

	if (!repositories.length) {
		return undefined;
	}

	return Array.from(new Set(repositories));
}

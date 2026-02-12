const GITHUB_API_VERSION = "2022-11-28";

export async function githubApiRequest(params: {
	url: string;
	method: "GET" | "POST";
	bearerToken: string;
	body?: Record<string, unknown>;
}): Promise<Response> {
	const { url, method, bearerToken, body } = params;

	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${bearerToken}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": GITHUB_API_VERSION,
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`GitHub API error (${response.status}): ${errorText.slice(0, 500)}`,
		);
	}

	return response;
}

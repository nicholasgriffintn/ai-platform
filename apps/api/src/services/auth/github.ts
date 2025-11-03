import { Octokit } from "@octokit/rest";

import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export interface GitHubUser {
	id: number;
	login: string;
	email: string;
	name?: string;
	avatar_url: string;
	company?: string;
	location?: string;
	bio?: string;
	twitter_username?: string;
	site?: string;
}

export async function handleGitHubOAuthCallback({
	context,
	env,
	code,
}: {
	context?: ServiceContext;
	env?: IEnv;
	code: string;
}): Promise<{ user: GitHubUser; sessionId: string }> {
	const serviceContext = resolveServiceContext({ context, env });

	if (
		!serviceContext.env.GITHUB_CLIENT_ID ||
		!serviceContext.env.GITHUB_CLIENT_SECRET
	) {
		throw new AssistantError(
			"Missing GitHub OAuth configuration",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const tokenResponse = await fetch(
		"https://github.com/login/oauth/access_token",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				client_id: serviceContext.env.GITHUB_CLIENT_ID,
				client_secret: serviceContext.env.GITHUB_CLIENT_SECRET,
				code,
			}),
		},
	);

	const tokenData = (await tokenResponse.json()) as {
		access_token: string;
		scope: string;
		token_type: string;
		error?: string;
		error_description?: string;
	};

	if (tokenData.error) {
		throw new AssistantError(
			`GitHub OAuth error: ${tokenData.error_description}`,
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const accessToken = tokenData.access_token;

	const { githubUser, primaryEmail } = await getGitHubUserData(accessToken);

	const user = await serviceContext.repositories.users.createOrUpdateGithubUser(
		{
			githubId: githubUser.id.toString(),
			username: githubUser.login,
			email: primaryEmail,
			name: githubUser.name || undefined,
			avatar_url: githubUser.avatar_url,
			company: githubUser.company || undefined,
			location: githubUser.location || undefined,
			bio: githubUser.bio || undefined,
			twitter_username: githubUser.twitter_username || undefined,
			site: githubUser.site || undefined,
		},
	);

	const sessionId = generateId();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

	await serviceContext.repositories.sessions.createSession(
		sessionId,
		user.id,
		expiresAt,
	);

	return {
		user: {
			id: user.id,
			login: (user as any).username,
			email: (user as any).email,
			name: (user as any).name || undefined,
			avatar_url: (user as any).avatar_url,
			company: (user as any).company || undefined,
			location: (user as any).location || undefined,
			bio: (user as any).bio || undefined,
			twitter_username: (user as any).twitter_username || undefined,
			site: (user as any).site || undefined,
		},
		sessionId,
	};
}

async function getGitHubUserData(accessToken: string): Promise<{
	githubUser: any;
	primaryEmail: string;
}> {
	const octokit = new Octokit({
		auth: accessToken,
	});

	const { data: githubUser } = await octokit.users.getAuthenticated();
	const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser();

	const primaryEmail =
		emails.find((email) => email.primary)?.email || emails[0]?.email;

	if (!primaryEmail) {
		throw new AssistantError(
			"Could not retrieve email from GitHub account",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	return { githubUser, primaryEmail };
}

export function getGitHubAuthUrl(env: IEnv): string {
	if (!env.GITHUB_CLIENT_ID) {
		throw new AssistantError(
			"Missing GitHub OAuth configuration",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=user:email`;
}

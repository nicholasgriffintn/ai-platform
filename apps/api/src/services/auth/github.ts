import { type ExternalIdentity, isRecord } from "@ngriffin_uk/auth-core";
import type { OAuthTokenSet } from "@ngriffin_uk/auth-oauth2";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { type AssistantAuthUser, toAssistantAuthUser } from "~/services/auth/authUser";
import { getStringRecordValue } from "~/utils/objects";

export async function resolveGitHubIdentity(
  tokens: OAuthTokenSet,
  _claims: unknown,
  context: Readonly<Record<string, string>>,
): Promise<ExternalIdentity> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${tokens.accessToken}`,
    "User-Agent": "Assistant",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const [profileResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);

  if (!profileResponse.ok || !emailsResponse.ok) {
    throw new Error("GitHub profile request failed.");
  }

  const profile = await profileResponse.json();
  const emails = await emailsResponse.json();

  if (!isGitHubApiProfile(profile) || !Array.isArray(emails)) {
    throw new TypeError("GitHub returned an invalid profile.");
  }

  const verifiedEmails = emails.filter(isVerifiedGitHubEmail);
  const email =
    verifiedEmails.find((candidate) => candidate.primary)?.email ?? verifiedEmails[0]?.email;

  if (!email) {
    throw new TypeError("A verified GitHub email address is required.");
  }

  return {
    provider: "github",
    providerSubject: String(profile.id),
    email,
    emailVerified: true,
    claims: {
      profile: {
        login: profile.login,
        email,
        name: getStringRecordValue(profile, "name"),
        avatarUrl: profile.avatar_url,
        company: getStringRecordValue(profile, "company"),
        location: getStringRecordValue(profile, "location"),
        bio: getStringRecordValue(profile, "bio"),
        twitterUsername: getStringRecordValue(profile, "twitter_username"),
        site: getStringRecordValue(profile, "blog"),
        mobileRedirectUri: context["mobileRedirectUri"],
      },
    },
  };
}

export async function resolveGitHubUser(
  context: ServiceContext,
  identity: ExternalIdentity,
): Promise<AssistantAuthUser> {
  const profile = readGitHubProfile(identity);
  const user = await context.repositories.users.createOrUpdateGithubUser({
    githubId: identity.providerSubject,
    username: profile.login,
    email: profile.email,
    name: profile.name,
    avatar_url: profile.avatarUrl,
    company: profile.company,
    location: profile.location,
    bio: profile.bio,
    twitter_username: profile.twitterUsername,
    site: profile.site,
  });
  const continuation = profile.mobileRedirectUri
    ? { mobileRedirectUri: profile.mobileRedirectUri }
    : undefined;

  return {
    ...toAssistantAuthUser(user),
    ...(continuation ? { continuation } : {}),
  };
}

function readGitHubProfile(identity: ExternalIdentity) {
  const value = identity.claims["profile"];

  if (!isRecord(value)) {
    throw new TypeError("GitHub returned an invalid identity.");
  }

  const login = getStringRecordValue(value, "login");
  const email = getStringRecordValue(value, "email");
  const avatarUrl = getStringRecordValue(value, "avatarUrl");

  if (!login || !email || !avatarUrl) {
    throw new TypeError("GitHub returned an invalid identity.");
  }

  return {
    login,
    email,
    avatarUrl,
    name: getStringRecordValue(value, "name"),
    company: getStringRecordValue(value, "company"),
    location: getStringRecordValue(value, "location"),
    bio: getStringRecordValue(value, "bio"),
    twitterUsername: getStringRecordValue(value, "twitterUsername"),
    site: getStringRecordValue(value, "site"),
    mobileRedirectUri: getStringRecordValue(value, "mobileRedirectUri"),
  };
}

function isGitHubApiProfile(value: unknown): value is GitHubApiProfile {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.login === "string" &&
    typeof value.avatar_url === "string"
  );
}

function isVerifiedGitHubEmail(
  value: unknown,
): value is { email: string; verified: true; primary: boolean } {
  return (
    isRecord(value) &&
    typeof value.email === "string" &&
    value.verified === true &&
    typeof value.primary === "boolean"
  );
}

interface GitHubApiProfile extends Record<string, unknown> {
  id: number;
  login: string;
  avatar_url: string;
}

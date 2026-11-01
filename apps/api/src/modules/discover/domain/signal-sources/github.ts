import { formatConjunctionList } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { first, joinParts, lines, records } from "./read";
import type { DiscoverSignal } from "./types";

const GITHUB_EVENT_PAGE = 100;
const GITHUB_SHARED_EVENTS = new Set(["WatchEvent", "ForkEvent", "PublicEvent", "ReleaseEvent"]);

interface GithubPick {
  repo: string;
  url: string;
  title: string;
  people: Set<string>;
  releases: string[];
  date: string;
}

function githubEvents(results: unknown): Record<string, unknown>[] {
  return (Array.isArray(results) ? results : []).flatMap((result) =>
    records(result, ["data", "details"], ["data", "items"], ["data"]).filter((event) =>
      GITHUB_SHARED_EVENTS.has(first(event, ["type"])),
    ),
  );
}

function describePeople(people: ReadonlySet<string>): string {
  const names = [...people];

  return formatConjunctionList(
    names.length > 3 ? [...names.slice(0, 3), `${names.length - 3} more`] : names,
  );
}

function githubPicks(results: unknown): DiscoverResearchResult[] {
  const picks = new Map<string, GithubPick>();

  for (const event of githubEvents(results)) {
    const repo = first(event, ["repo", "name"]);
    const actor = first(event, ["actor", "display_login"], ["actor", "login"]);

    if (!repo || !actor) {
      continue;
    }

    const pick = picks.get(repo) ?? {
      repo,
      url: `https://github.com/${repo}`,
      title: repo,
      people: new Set<string>(),
      releases: [],
      date: first(event, ["created_at"]).slice(0, 10),
    };
    const release = first(
      event,
      ["payload", "release", "name"],
      ["payload", "release", "tag_name"],
    );

    if (first(event, ["type"]) === "ReleaseEvent" && release) {
      pick.releases.push(release);
      pick.url = first(event, ["payload", "release", "html_url"]) || pick.url;
      pick.title = `${repo} ${release}`;
    } else {
      pick.people.add(actor);
    }

    picks.set(repo, pick);
  }

  return [...picks.values()]
    .sort((left, right) => right.people.size - left.people.size)
    .map((pick) => ({
      title: pick.title,
      url: pick.url,
      snippet:
        pick.people.size > 0
          ? `Starred or shared by ${describePeople(pick.people)}`
          : `New release: ${pick.releases[0] ?? ""}`,
      source: pick.people.size > 1 ? `GitHub, ${pick.people.size} people you follow` : "GitHub",
      date: pick.date,
    }));
}

export const GITHUB_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "github-following",
    providerId: "github",
    group: "social",
    title: "GitHub following",
    description: "Reads the repositories the people you follow star, share and release.",
    operation: "GITHUB_GET_THE_AUTHENTICATED_USER",
    parameters: () => ({}),
    expand: {
      operation: "GITHUB_LIST_EVENTS_RECEIVED_BY_THE_AUTHENTICATED_USER",
      requests: (result) => {
        const username = first(result, ["data", "login"], ["login"]);

        return username ? [{ username, per_page: GITHUB_EVENT_PAGE }] : [];
      },
    },
    items: (results) => githubPicks(results),
    digest: (results) =>
      lines(githubPicks(results), (pick) =>
        joinParts(first(pick, ["title"]), first(pick, ["snippet"])),
      ),
  },
];

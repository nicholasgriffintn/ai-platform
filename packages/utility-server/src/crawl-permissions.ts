interface RobotsRule {
  allow: boolean;
  pattern: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export interface RobotsPolicy {
  groups: RobotsGroup[];
}

const RESERVING_ROBOTS_DIRECTIVES = new Set(["noai", "noindex", "none", "noimageai"]);

export function parseRobotsTxt(text: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.replace(/#.*$/u, "").trim();
    const separator = line.indexOf(":");

    if (separator === -1) {
      continue;
    }

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }

      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;

    if (current && (field === "allow" || field === "disallow") && value) {
      current.rules.push({ allow: field === "allow", pattern: value });
    }
  }

  return { groups };
}

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const expression = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, "\\$&"))
    .join(".*");

  return new RegExp(`^${expression}${anchored ? "$" : ""}`, "u").test(path);
}

export function isRobotsAllowed(policy: RobotsPolicy, userAgent: string, path: string): boolean {
  const agent = userAgent.toLowerCase();
  const specific = policy.groups.filter((group) =>
    group.agents.some((name) => name !== "*" && agent.includes(name)),
  );
  const groups = specific.length
    ? specific
    : policy.groups.filter((group) => group.agents.includes("*"));
  const matched = groups
    .flatMap((group) => group.rules)
    .filter((rule) => patternMatches(rule.pattern, path))
    .sort(
      (left, right) =>
        right.pattern.length - left.pattern.length || Number(right.allow) - Number(left.allow),
    )[0];

  return matched?.allow ?? true;
}

export function isCrawlReserved(headers: Pick<Headers, "get">): boolean {
  if (headers.get("tdm-reservation")?.trim() === "1") {
    return true;
  }

  return (headers.get("x-robots-tag") ?? "")
    .split(/[,;]/u)
    .map((directive) => directive.split(":").at(-1)?.trim().toLowerCase() ?? "")
    .some((directive) => RESERVING_ROBOTS_DIRECTIVES.has(directive));
}

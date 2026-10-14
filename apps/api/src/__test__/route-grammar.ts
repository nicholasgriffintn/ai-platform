const RESOURCE_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);
const LITERAL_SEGMENT = /^[a-z][a-z0-9_]*$/;
const PARAM_SEGMENT = /^:(?:[a-z][a-z0-9_]*_id|token)$/;

const PROTOCOL_ROUTES = [
  /^\/auth(\/|$)/,
  /^\/webhooks\//,
  /^\/sync\/ws$/,
  /^\/chat\/completions$/,
  /^\/desktop\/(releases|updates)\//,
  /^\/realtime\/openai\/live\/calls$/,
  /^\/internal\//,
];

export function grammarViolations(route: string): string[] {
  const [method = "", path = ""] = route.split(" ");

  if (PROTOCOL_ROUTES.some((pattern) => pattern.test(path))) {
    return [];
  }

  const violations: string[] = [];

  if (!RESOURCE_METHODS.has(method)) {
    violations.push(`${route}: use GET, POST, PATCH or DELETE`);
  }

  for (const segment of path.split("/").filter(Boolean)) {
    const valid = segment.startsWith(":")
      ? PARAM_SEGMENT.test(segment)
      : LITERAL_SEGMENT.test(segment);

    if (!valid) {
      violations.push(`${route}: segment "${segment}" breaks the grammar`);
    }
  }

  return violations;
}

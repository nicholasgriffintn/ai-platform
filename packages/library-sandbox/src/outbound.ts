import { authorise } from "@ngriffin_uk/polychat-library-policy";

export const TOOLS_ORIGIN = "https://tools.polychat.invalid";

export type OutboundAllowlist = "all" | "none" | readonly string[];

export interface OutboundGatewayProps {
  allowlist: OutboundAllowlist;
  toolsOrigin?: string;
  invocationId?: string;
}

export type OutboundDecision =
  | { kind: "tool"; tool: string }
  | { kind: "allow" }
  | { kind: "block"; reason: string };

function hostMatchesPatterns(host: string, patterns: readonly string[]): boolean {
  const candidate = host.toLowerCase().replace(/\.+$/, "");

  return patterns.some((pattern) => {
    const normalised = pattern.trim().toLowerCase();

    if (!normalised) {
      return false;
    }

    if (normalised.startsWith("*.")) {
      const suffix = normalised.slice(1);

      return candidate.endsWith(suffix) && candidate.length > suffix.length;
    }

    return candidate === normalised;
  });
}

export function isHostAllowed(host: string, allowlist: OutboundAllowlist): boolean {
  const hostMatched = typeof allowlist !== "string" && hostMatchesPatterns(host, allowlist);

  return authorise("sandbox.network", {
    protocolAllowed: true,
    mode: typeof allowlist === "string" ? allowlist : "list",
    hostMatched,
  }).allowed;
}

export function parseToolRequest(url: URL, toolsOrigin = TOOLS_ORIGIN): string | null {
  if (url.origin !== toolsOrigin) {
    return null;
  }

  const [tool, ...rest] = url.pathname.split("/").filter(Boolean);

  if (!tool || rest.length > 0) {
    return null;
  }

  try {
    return decodeURIComponent(tool);
  } catch {
    return null;
  }
}

export function decideOutbound(props: OutboundGatewayProps, url: URL): OutboundDecision {
  const tool = parseToolRequest(url, props.toolsOrigin ?? TOOLS_ORIGIN);

  if (tool !== null) {
    return authorise("sandbox.tool", { attached: Boolean(props.invocationId) }).allowed
      ? { kind: "tool", tool }
      : { kind: "block", reason: "This sandbox has no tools attached" };
  }

  if (
    !authorise("sandbox.network", {
      protocolAllowed: url.protocol === "https:" || url.protocol === "http:",
      mode: "all",
      hostMatched: false,
    }).allowed
  ) {
    return { kind: "block", reason: `Protocol ${url.protocol} is not allowed` };
  }

  return isHostAllowed(url.hostname, props.allowlist)
    ? { kind: "allow" }
    : { kind: "block", reason: `Network access to ${url.hostname} is not allowed` };
}

export function outboundNeedsGateway(props: OutboundGatewayProps): boolean {
  return props.invocationId !== undefined || Array.isArray(props.allowlist);
}

export const SANDBOX_PACKAGE_REGISTRY_HOSTS = [
  "registry.npmjs.org",
  "registry.yarnpkg.com",
  "repo.yarnpkg.com",
  "pypi.org",
  "files.pythonhosted.org",
  "crates.io",
  "index.crates.io",
  "static.crates.io",
  "proxy.golang.org",
  "sum.golang.org",
  "rubygems.org",
  "index.rubygems.org",
  "repo.maven.apache.org",
  "repo1.maven.org",
  "plugins.gradle.org",
  "services.gradle.org",
] as const;

const SAFE_EGRESS_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface ContainerEgressPolicy {
  mode: "all" | "list";
  hosts: readonly string[];
  readOnlyHosts: readonly string[];
}

export type ContainerEgressDecision = { kind: "allow" } | { kind: "block"; reason: string };

export function decideContainerEgress(
  policy: ContainerEgressPolicy,
  request: { url: URL; method: string },
): ContainerEgressDecision {
  const { url } = request;
  const method = request.method.toUpperCase();
  const decision = authorise("sandbox.egress", {
    protocolAllowed: url.protocol === "https:" || url.protocol === "http:",
    mode: policy.mode,
    hostMatched: hostMatchesPatterns(url.hostname, policy.hosts),
    readOnlyHostMatched: hostMatchesPatterns(url.hostname, policy.readOnlyHosts),
    safeMethod: SAFE_EGRESS_METHODS.has(method),
  });

  if (decision.allowed) {
    return { kind: "allow" };
  }

  return hostMatchesPatterns(url.hostname, policy.readOnlyHosts)
    ? { kind: "block", reason: `${method} requests to ${url.hostname} are not allowed` }
    : { kind: "block", reason: `Network access to ${url.hostname} is not allowed` };
}

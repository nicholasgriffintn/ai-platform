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

export function isHostAllowed(host: string, allowlist: OutboundAllowlist): boolean {
  if (allowlist === "all") {
    return true;
  }

  if (allowlist === "none") {
    return false;
  }

  const candidate = host.toLowerCase();

  return allowlist.some((pattern) => {
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
    return props.invocationId
      ? { kind: "tool", tool }
      : { kind: "block", reason: "This sandbox has no tools attached" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { kind: "block", reason: `Protocol ${url.protocol} is not allowed` };
  }

  return isHostAllowed(url.hostname, props.allowlist)
    ? { kind: "allow" }
    : { kind: "block", reason: `Network access to ${url.hostname} is not allowed` };
}

export function outboundNeedsGateway(props: OutboundGatewayProps): boolean {
  return props.invocationId !== undefined || Array.isArray(props.allowlist);
}

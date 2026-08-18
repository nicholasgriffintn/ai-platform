import type { IEnv } from "~/types";

export type PrivateFileResourceKind = "source" | "output";

export function buildPrivateFileUrl(
  env: IEnv,
  kind: PrivateFileResourceKind,
  resourceId: string,
): string {
  const path = `/${kind === "source" ? "sources" : "outputs"}/${resourceId}/content`;
  const baseUrl = env.API_BASE_URL?.replace(/\/$/, "");

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getPrivateFileResourceFromUrl(
  url: string,
  apiBaseUrl?: string,
): { kind: PrivateFileResourceKind; id: string } | undefined {
  const fallbackBaseUrl = "https://polychat.local";

  try {
    const baseUrl = new URL(apiBaseUrl || fallbackBaseUrl);
    const parsedUrl = new URL(url, baseUrl);

    if (parsedUrl.origin !== baseUrl.origin) {
      return undefined;
    }

    const match = parsedUrl.pathname.match(/^\/(sources|outputs)\/([^/]+)\/content$/);

    if (!match) {
      return undefined;
    }

    return {
      kind: match[1] === "sources" ? "source" : "output",
      id: decodeURIComponent(match[2]),
    };
  } catch {
    return undefined;
  }
}

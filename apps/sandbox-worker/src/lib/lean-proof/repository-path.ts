import { quoteForShell, type SandboxExecInstance } from "../commands";

const SAFE_REPOSITORY_PATH = /^[A-Za-z0-9_.@+/-]+$/;

export function assertRepositoryRelativePath(path: string): string {
  const trimmed = path.trim();
  const segments = trimmed.split("/");

  if (
    !trimmed ||
    trimmed.startsWith("/") ||
    trimmed.includes("\\") ||
    trimmed.includes(":") ||
    !SAFE_REPOSITORY_PATH.test(trimmed) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Path must be a normalised repository-relative path");
  }

  return trimmed;
}

function isContainedPath(root: string, candidate: string): boolean {
  const normalisedRoot = root.replace(/\/+$/, "");

  return candidate === normalisedRoot || candidate.startsWith(`${normalisedRoot}/`);
}

export async function resolveContainedRepositoryFile(
  sandbox: SandboxExecInstance,
  repositoryRoot: string,
  relativePath: string,
): Promise<string> {
  const safePath = assertRepositoryRelativePath(relativePath);
  const candidate = `${repositoryRoot.replace(/\/+$/, "")}/${safePath}`;
  const result = await sandbox.exec(`realpath -e -- ${quoteForShell(candidate)}`);
  const resolved = result.stdout.trim();

  if (!result.success || !resolved) {
    throw new Error(`Repository file does not exist: ${safePath}`);
  }

  const rootResult = await sandbox.exec(`realpath -e -- ${quoteForShell(repositoryRoot)}`);
  const resolvedRoot = rootResult.stdout.trim();

  if (!rootResult.success || !resolvedRoot || !isContainedPath(resolvedRoot, resolved)) {
    throw new Error(`Repository file resolves outside the checkout: ${safePath}`);
  }

  return resolved;
}

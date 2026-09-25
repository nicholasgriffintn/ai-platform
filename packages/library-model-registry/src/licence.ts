const LICENCE_ALIASES: Record<string, string> = {
  "apache 2.0": "apache-2.0",
  apache2: "apache-2.0",
  "apache-2": "apache-2.0",
  "apache license 2.0": "apache-2.0",
  "mit license": "mit",
  "bsd-3": "bsd-3-clause",
  "bsd 3-clause": "bsd-3-clause",
  "cc-by-4": "cc-by-4.0",
  "cc by 4.0": "cc-by-4.0",
  "llama3.1": "llama3.1",
  "llama 3.1": "llama3.1",
  "llama3.2": "llama3.2",
  "llama3.3": "llama3.3",
};

export const PERMISSIVE_LICENCES = [
  "apache-2.0",
  "mit",
  "bsd-2-clause",
  "bsd-3-clause",
  "cc-by-4.0",
  "cc0-1.0",
  "unlicense",
] as const;

export const DEFAULT_ALLOWED_LICENCES = [
  ...PERMISSIVE_LICENCES,
  "llama3.1",
  "llama3.2",
  "llama3.3",
  "gemma",
  "openrail",
  "openrail++",
  "internal",
] as const;

export function normaliseLicence(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw.find((item) => typeof item === "string") : raw;

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed || trimmed === "other" || trimmed === "unknown") {
    return null;
  }

  return LICENCE_ALIASES[trimmed] ?? trimmed.replace(/\s+/g, "-");
}

export function isPermissiveLicence(licence: string | null): boolean {
  return licence !== null && (PERMISSIVE_LICENCES as readonly string[]).includes(licence);
}

export type RegistryErrorCode = "duplicate_registration" | "unknown_category" | "unknown_entry";

export class RegistryError extends Error {
  readonly code: RegistryErrorCode;
  readonly category: string;
  readonly entryName?: string;

  constructor(code: RegistryErrorCode, category: string, entryName?: string) {
    super(
      entryName
        ? `Registry error "${code}" for "${entryName}" in category "${category}"`
        : `Registry error "${code}" for category "${category}"`,
    );

    this.name = "RegistryError";
    this.code = code;
    this.category = category;
    this.entryName = entryName;
  }
}

export function isRegistryError(error: unknown): error is RegistryError {
  return error instanceof RegistryError;
}

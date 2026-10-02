export type ProviderTypeFilter = "all" | "connected" | "chat" | "messaging" | "embedding";

export function readProviderTypeFilter(value: string | null): ProviderTypeFilter {
  switch (value) {
    case "connected":
    case "chat":
    case "messaging":
    case "embedding":
      return value;
    default:
      return "all";
  }
}

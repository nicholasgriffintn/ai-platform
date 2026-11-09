import { readEnvString } from "@ngriffin_uk/polychat-utility-server/env";

const DEFAULT_PASHI_ORIGIN = "https://pashi.app";

export function resolvePashiOrigin(
  value?: string,
  { allowLocal = false }: { allowLocal?: boolean } = {},
): string {
  const configured = readEnvString(value);

  if (!configured || !allowLocal) {
    return DEFAULT_PASHI_ORIGIN;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_PASHI_ORIGIN;
  }
}

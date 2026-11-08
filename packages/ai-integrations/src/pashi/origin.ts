import { readEnvString } from "@ngriffin_uk/polychat-utility-server/env";

const DEFAULT_PASHI_ORIGIN = "https://pashi.app";

export function resolvePashiOrigin(value?: string): string {
  const configured = readEnvString(value);

  return configured ? new URL(configured).origin : DEFAULT_PASHI_ORIGIN;
}

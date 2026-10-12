import type { Fetch } from "./http.js";

export interface CommandContext {
  apiBaseUrl: string;
  credentialsPath: string;
  fetch: Fetch;
  out: (line: string) => void;
  info: (line: string) => void;
}

import { describe, expect, it } from "vitest";

import {
  externalHttpUrlSchema,
  internalNavigationPathSchema,
  isExternalHttpUrl,
  isInternalNavigationPath,
} from "./navigation";

describe("navigation contracts", () => {
  it.each(["/work/project-1/chat", "/profile?tab=providers"])(
    "accepts internal path %s",
    (path) => {
      expect(isInternalNavigationPath(path)).toBe(true);
      expect(internalNavigationPathSchema.safeParse(path).success).toBe(true);
    },
  );

  it.each([
    "javascript:alert(1)",
    "https://attacker.example",
    "//attacker.example/path",
    "/\\attacker.example/path",
  ])("rejects unsafe internal path %s", (path) =>
    expect(isInternalNavigationPath(path)).toBe(false),
  );

  it.each([
    "https://accounts.example.com/oauth",
    "http://localhost:8787/oauth",
    "http://127.0.0.1:8787/oauth",
  ])("accepts external URL %s", (url) => {
    expect(isExternalHttpUrl(url)).toBe(true);
    expect(externalHttpUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "data:text/html,unsafe", "http://attacker.example"])(
    "rejects unsafe external URL %s",
    (url) => expect(isExternalHttpUrl(url)).toBe(false),
  );
});

import { API_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { describe, expect, it } from "vitest";

import packagedConfiguration from "../../src-tauri/tauri.conf.json";
import devConfiguration from "../../src-tauri/tauri.dev.conf.json";

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);

      return [name, sources] as const;
    }),
  );
}

const packaged = directives(packagedConfiguration.app.security.csp);
const development = directives(devConfiguration.app.security.csp);

describe("the desktop content security policy", () => {
  it.each(["img-src", "media-src", "connect-src"])(
    "lets %s reach the API the renderer is built against",
    (directive) => {
      expect(packaged.get(directive)).toContain("https://api.polychat.app");
    },
  );

  it("lets the window show the avatars the API reports for accounts", () => {
    expect(packaged.get("img-src")).toContain("https://avatars.githubusercontent.com");
  });

  it("keeps the window from loading code or being framed", () => {
    expect(packaged.get("script-src")).toEqual(["'self'"]);
    expect(packaged.get("object-src")).toEqual(["'none'"]);
    expect(packaged.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("reaches the API the development renderer is built against", () => {
    expect(development.get("connect-src")).toContain(API_BASE_URL);
  });

  it("grants development every source the packaged window holds", () => {
    for (const [directive, sources] of packaged) {
      expect(development.get(directive)).toEqual(expect.arrayContaining(sources));
    }
  });
});

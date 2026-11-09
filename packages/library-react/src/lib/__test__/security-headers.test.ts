// @vitest-environment jsdom

import { MCP_APP_FRAME_DOCUMENT_URL } from "@ngriffin_uk/polychat-library-client";
import { describe, expect, it } from "vitest";

import { applySecurityHeaders } from "../security-headers.js";

const parseCsp = (headers: Headers) =>
  new Map(
    (headers.get("Content-Security-Policy") ?? "")
      .split(";")
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...sources] = directive.split(/\s+/);

        return [name, sources] as const;
      }),
  );

describe("applySecurityHeaders", () => {
  it("blocks framing of the document by any origin", () => {
    const headers = applySecurityHeaders(new Headers(), "https://polychat.app/chat");

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(parseCsp(headers).get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("frames app views from their own sandbox origin and lets them be granted the microphone", () => {
    const headers = applySecurityHeaders(new Headers(), "https://polychat.app/chat");
    const policy = headers.get("Permissions-Policy") ?? "";

    expect(policy).toContain("microphone=*");
    expect(policy).toContain("camera=*");
    expect(policy).toContain("geolocation=()");
    expect(parseCsp(headers).get("frame-src")).toContain(
      new URL(MCP_APP_FRAME_DOCUMENT_URL).origin,
    );
  });

  it("locks down directives an injected tag could otherwise abuse", () => {
    const csp = parseCsp(applySecurityHeaders(new Headers(), "https://polychat.app/"));

    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("form-action")?.[0]).toBe("'self'");
  });

  it("does not relax the opener policy outside the connector callback", () => {
    for (const url of [
      "https://polychat.app/profile?tab=providers",
      "https://polychat.app/profile?connected=1",
      "https://polychat.app/chat/plugins?connector=airtable",
      "https://polychat.app/chat?connector=airtable&connected=1",
    ]) {
      expect(applySecurityHeaders(new Headers(), url).get("Cross-Origin-Opener-Policy")).toBe(
        "same-origin-allow-popups",
      );
    }
  });
});

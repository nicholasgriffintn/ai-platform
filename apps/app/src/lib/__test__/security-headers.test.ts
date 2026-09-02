import { describe, expect, it } from "vitest";

import { applySecurityHeaders } from "../security-headers";

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

  it("locks down directives an injected tag could otherwise abuse", () => {
    const csp = parseCsp(applySecurityHeaders(new Headers(), "https://polychat.app/"));

    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("form-action")?.[0]).toBe("'self'");
  });

  it("keeps microphone and camera available to the app's own realtime surfaces", () => {
    const headers = applySecurityHeaders(new Headers(), "https://polychat.app/");
    const policy = headers.get("Permissions-Policy") ?? "";

    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("geolocation=()");
  });

  it("allows sign-in popups to keep talking to their opener", () => {
    const headers = applySecurityHeaders(new Headers(), "https://polychat.app/");

    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
  });

  it("keeps the opener attached when a connector popup returns to the callback", () => {
    const headers = applySecurityHeaders(
      new Headers(),
      "https://polychat.app/profile?tab=providers&type=connector&connector=airtable&connected=1",
    );

    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("unsafe-none");
  });

  it("does not relax the opener policy for profile routes that are not the callback", () => {
    for (const url of [
      "https://polychat.app/profile?tab=providers",
      "https://polychat.app/profile?connected=1",
      "https://polychat.app/chat?connector=airtable&connected=1",
    ]) {
      expect(applySecurityHeaders(new Headers(), url).get("Cross-Origin-Opener-Policy")).toBe(
        "same-origin-allow-popups",
      );
    }
  });

  it("only sends HSTS over https so local http development still works", () => {
    const secure = applySecurityHeaders(new Headers(), "https://polychat.app/");
    const local = applySecurityHeaders(new Headers(), "http://localhost:5173/");

    expect(secure.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(local.get("Strict-Transport-Security")).toBeNull();
  });

  it("replaces rather than appends when applied to headers that already carry a policy", () => {
    const headers = new Headers({ "Content-Security-Policy": "default-src 'none'" });

    applySecurityHeaders(headers, "https://polychat.app/");

    expect(headers.get("Content-Security-Policy")).not.toContain("default-src 'none';");
    expect(parseCsp(headers).get("default-src")).toEqual(["'self'"]);
  });
});

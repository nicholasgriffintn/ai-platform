import { describe, expect, it } from "vitest";

import { hardenSandboxDocument, hardenStandaloneHtml } from "./artifact-sandbox";

describe("hardenSandboxDocument", () => {
  it("injects the policy after a bare head tag and after one with attributes", () => {
    expect(hardenSandboxDocument("<html><head><title>x</title></head></html>")).toContain(
      '<head><meta http-equiv="Content-Security-Policy"',
    );
    expect(hardenSandboxDocument('<html><HEAD lang="en"><title>x</title></HEAD></html>')).toContain(
      '<HEAD lang="en"><meta http-equiv="Content-Security-Policy"',
    );
  });

  it("leaves a document with no head tag alone", () => {
    expect(hardenSandboxDocument("<p>no head here</p>")).toBe("<p>no head here</p>");
  });

  it("places the prelude after the policy and before the page's own head content", () => {
    const document = hardenSandboxDocument(
      "<html><head><script>page()</script></head></html>",
      "<script>prelude()</script>",
    );

    expect(document).toMatch(
      /<head><meta http-equiv="Content-Security-Policy"[^>]*><script>prelude\(\)<\/script><script>page\(\)<\/script>/u,
    );
  });

  it("does not treat a longer tag name as head", () => {
    expect(hardenSandboxDocument("<header>x</header>")).toBe("<header>x</header>");
  });

  it("stays linear on an unterminated head tag", () => {
    const started = Date.now();

    hardenSandboxDocument(`<head ${"a".repeat(200_000)}`);

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe("artifact sandbox policy", () => {
  it("blocks preview documents from connecting or navigating away", () => {
    const document = hardenSandboxDocument(
      "<!doctype html><html><head></head><body><script>fetch('https://example.com')</script></body></html>",
    );

    expect(document).toContain("default-src 'none'");
    expect(document).toContain(
      "script-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js https://cdnjs.cloudflare.com/ajax/libs/prop-types/15.8.1/prop-types.min.js https://cdnjs.cloudflare.com/ajax/libs/recharts/2.15.0/Recharts.min.js",
    );
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain("form-action 'none'");
    expect(document).toContain("navigate-to 'none'");
  });

  it("still applies the policy to model HTML that arrives without a head", () => {
    expect(hardenStandaloneHtml("<svg><circle r='4'/></svg><header>x</header>")).toContain(
      '<head><meta http-equiv="Content-Security-Policy"',
    );
  });
});

import { expect, it } from "vitest";

import {
  createSandboxOutputRedactor,
  redactSandboxValue,
  secretRedactionVariants,
} from "../redaction.js";

it("redacts credentials split across arbitrary chunks and line boundaries", () => {
  const secret = "private\ncredential-private";
  const output = `Starting\n${secret}\nBearer\nunknown-token\nFinished\n`;

  for (let split = 1; split < output.length; split += 1) {
    const redactor = createSandboxOutputRedactor([secret]);
    const parts = [
      redactor.push(output.slice(0, split)),
      redactor.push(output.slice(split)),
      redactor.flush(),
    ];
    const result = parts.join("");

    expect(result).not.toContain("credential-private");
    expect(result).not.toContain("unknown-token");
    expect(result).toContain("Starting");
    expect(result).toContain("Finished");
    expect(result).toContain("[redacted");
  }
});

it("withholds and redacts a truncated credential when the stream ends", () => {
  const redactor = createSandboxOutputRedactor(["private-credential"]);

  expect(redactor.push("private-cred")).toBe("");
  expect(redactor.flush()).toBe("[redacted credential]");
});

it("redacts a complete secret whose suffix is also its prefix", () => {
  const redactor = createSandboxOutputRedactor(["abca"]);

  expect(redactor.push("abca") + redactor.flush()).toBe("[redacted credential]");
});

it("redacts a secret and its base64 and URL-encoded forms anywhere in a structured value", () => {
  const secret = "sk_live/private+value=1 key";
  const output = JSON.stringify(
    redactSandboxValue(
      {
        headers: { "x-echo": secret },
        body: [
          { token: btoa(secret), callback: `https://x.test/?k=${encodeURIComponent(secret)}` },
        ],
      },
      secretRedactionVariants(secret),
    ),
  );

  for (const form of [secret, btoa(secret), encodeURIComponent(secret)]) {
    expect(output).not.toContain(form);
  }
});

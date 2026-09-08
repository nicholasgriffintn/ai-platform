import { expect, it } from "vitest";

import { createSandboxOutputRedactor } from "./output-redaction";

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

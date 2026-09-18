import { describe, expect, it } from "vitest";

import {
  buildDataIndexSource,
  buildProviderIdsSource,
  buildToolkitFiles,
  listStaleToolkitFiles,
  toolkitFileName,
  validateManifest,
} from "./catalogue-files.mjs";

function rawToolkit(overrides = {}) {
  return {
    providerId: "gmail",
    name: "Gmail",
    description: "Read and send Gmail.",
    logoUrl: "https://logos.composio.dev/api/gmail",
    categories: [{ id: "email", name: "Email" }],
    authConfigs: [{ id: "ac_gmail", name: "gmail", authScheme: "OAUTH2", isManaged: true }],
    toolkitSlug: "gmail",
    toolkitVersion: "20260101_00",
    toolCount: 2,
    readToolCount: 1,
    writeToolCount: 1,
    scopes: ["gmail.readonly", "gmail.send"],
    operations: {
      read: ["GMAIL_FETCH_EMAILS"],
      write: ["GMAIL_SEND_EMAIL"],
      important: ["GMAIL_SEND_EMAIL"],
      destructive: ["GMAIL_DELETE_MESSAGE"],
      idempotent: [],
      openWorld: ["GMAIL_SEND_EMAIL"],
    },
    ...overrides,
  };
}

describe("Composio catalogue file layout", () => {
  it("resolves raw toolkit operations into sorted policy-annotated operations", () => {
    const catalogue = validateManifest({ gmail: rawToolkit() });
    const toolkit = catalogue.toolkits.gmail;

    expect(toolkit?.operations).toEqual([
      {
        id: "GMAIL_FETCH_EMAILS",
        access: "read",
        readOnly: true,
        destructive: false,
        idempotent: false,
        openWorld: false,
        isImportant: false,
        authConfigIds: ["ac_gmail"],
      },
      {
        id: "GMAIL_SEND_EMAIL",
        access: "write",
        readOnly: false,
        destructive: false,
        idempotent: false,
        openWorld: true,
        isImportant: true,
        authConfigIds: ["ac_gmail"],
      },
    ]);
    expect(toolkit?.authConfigs).toEqual([
      { id: "ac_gmail", name: "gmail", authScheme: "OAUTH2", isManaged: true },
    ]);
  });

  it("writes one stable, pretty-printed JSON file per toolkit", () => {
    const files = buildToolkitFiles({ alpha: rawToolkit({ providerId: "alpha" }) });

    expect([...files.keys()]).toEqual(["alpha.json"]);
    expect(files.get("alpha.json")).toBe(
      `${JSON.stringify(rawToolkit({ providerId: "alpha" }), null, "\t")}\n`,
    );
  });

  it("lists removed toolkits and rejects unsafe ids", () => {
    expect(listStaleToolkitFiles(["alpha.json", "beta.json", "notes.md"], { beta: {} })).toEqual([
      "alpha.json",
    ]);
    expect(() => toolkitFileName("../secrets")).toThrow(/Unsafe/);
  });

  it("generates the data index and provider id list from the manifest keys", () => {
    const index = buildDataIndexSource(["alpha", "beta"]);

    expect(index).toContain('import toolkit0 from "./toolkits/alpha.json" with { type: "json" };');
    expect(index).toContain('"beta": toolkit1,');
    expect(buildProviderIdsSource(["alpha", "beta"])).toBe('[\n\t"alpha",\n\t"beta"\n]\n');
  });
});

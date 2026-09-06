import { describe, expect, it } from "vitest";

import { getOutputRestoreCapability } from "./revision-policy";

describe("output restore policy", () => {
  it("allows only enumerated local content outputs", () => {
    expect(
      getOutputRestoreCapability({
        capability_id: "notes",
        kind: "note",
        status: "ready",
        storage_key: null,
      }),
    ).toEqual({ supported: true, reason: null, fields: ["title", "content"] });
  });

  it("keeps external, sandbox, pending and file-backed effects review-only", () => {
    const cases = [
      { capability_id: "gmail", kind: "dynamic_app_response", status: "ready", storage_key: null },
      { capability_id: "sandbox", kind: "sandbox_artifact", status: "ready", storage_key: null },
      { capability_id: "notes", kind: "note", status: "pending", storage_key: null },
      {
        capability_id: "notes",
        kind: "note",
        status: "ready",
        storage_key: "outputs/note.txt",
      },
    ] as const;

    cases.forEach((output) => {
      expect(getOutputRestoreCapability(output)).toMatchObject({ supported: false, fields: [] });
    });
  });
});

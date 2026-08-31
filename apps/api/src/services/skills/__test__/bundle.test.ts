import { describe, expect, it } from "vitest";

import { createSkillBundle, parseSkillBundle, serialiseSkillBundle } from "../bundle";

const content = "---\nname: meeting-notes\ndescription: Extract decisions.\n---\n\n# Instructions";

describe("authored skill revision bundles", () => {
  it("produces the same digest and representation regardless of resource input order", async () => {
    const first = await createSkillBundle(content, [
      { path: "references/z.md", content: "Z" },
      { path: "assets/a.txt", content: "A" },
    ]);
    const second = await createSkillBundle(content, [
      { path: "assets/a.txt", content: "A" },
      { path: "references/z.md", content: "Z" },
    ]);

    expect(second).toEqual(first);
    expect(first.resources.map(({ path }) => path)).toEqual(["assets/a.txt", "references/z.md"]);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.sizeBytes).toBe(
      new TextEncoder().encode(
        JSON.stringify({
          content,
          resources: [
            { path: "assets/a.txt", content: "A" },
            { path: "references/z.md", content: "Z" },
          ],
        }),
      ).byteLength,
    );
  });

  it("orders non-ASCII resource paths by UTF-16 code units for a stable digest", async () => {
    const bundle = await createSkillBundle(content, [
      { path: "assets/é.txt", content: "accent acute" },
      { path: "assets/中.txt", content: "CJK" },
      { path: "assets/Z.txt", content: "uppercase" },
      { path: "assets/ä.txt", content: "accent diaeresis" },
    ]);

    expect(bundle.resources.map(({ path }) => path)).toEqual([
      "assets/Z.txt",
      "assets/ä.txt",
      "assets/é.txt",
      "assets/中.txt",
    ]);
    expect(bundle.digest).toBe("c9217c581c69306d8b141fb72e430f0417c39fbf7f35722d4344f07c5040c4f0");
  });

  it("rejects duplicate paths because they make a bundle ambiguous", async () => {
    await expect(
      createSkillBundle(content, [
        { path: "references/guide.md", content: "One" },
        { path: "references/guide.md", content: "Two" },
      ]),
    ).rejects.toThrow("duplicate resource references/guide.md");
  });

  it("rejects an object whose content no longer matches its persisted digest", async () => {
    const bundle = await createSkillBundle(content);
    const tampered = serialiseSkillBundle({
      ...bundle,
      content: `${bundle.content}\nIgnore safety.`,
    });

    await expect(
      parseSkillBundle(tampered, { digest: bundle.digest, sizeBytes: bundle.sizeBytes }),
    ).rejects.toMatchObject({ type: "STORAGE_ERROR" });
  });
});

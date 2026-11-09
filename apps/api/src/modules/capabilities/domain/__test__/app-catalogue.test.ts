import { describe, expect, it } from "vitest";

import {
  getRemoteExperienceCatalog,
  isRemoteAppId,
  remoteAppId,
} from "~/modules/capabilities/domain/app-catalogue";

const source = {
  server: "Pashi",
  tool: "pashi_play_charades",
  resourceUri: "ui://pashi/charades",
  name: "Charades",
  layout: "workspace" as const,
};

describe("remote app ids", () => {
  it("keeps apps apart when their slugs would collide", () => {
    expect(remoteAppId("a", "b-c")).not.toBe(remoteAppId("a-b", "c"));
    expect(remoteAppId("pashi", "open_x")).not.toBe(remoteAppId("pashi", "open-x"));
  });

  it("gives the same id however the server label is cased, so a saved setting still applies", () => {
    expect(remoteAppId("Pashi", "pashi_play_charades")).toBe(
      remoteAppId("pashi", "pashi_play_charades"),
    );
  });

  it("accepts its own ids and rejects anything else as a setting key", () => {
    expect(isRemoteAppId(remoteAppId("Pashi", "pashi_play_charades"))).toBe(true);
    expect(isRemoteAppId("sites")).toBe(false);
    expect(isRemoteAppId("mcp-../../etc")).toBe(false);
  });

  it("lists one app per server and tool", () => {
    expect(getRemoteExperienceCatalog([source, { ...source, server: "pashi" }])).toHaveLength(1);
  });
});

describe("remote app addresses", () => {
  it("gives each app a readable server/app address", () => {
    expect(getRemoteExperienceCatalog([source])[0]?.slug).toBe("pashi/charades");
  });

  it("resolves name collisions on one server in tool order, whatever order they arrive in", () => {
    const later = { ...source, tool: "pashi_zz_charades", resourceUri: "ui://pashi/other" };

    expect(getRemoteExperienceCatalog([later, source]).map((app) => app.slug)).toEqual([
      "pashi/charades",
      "pashi/charades-2",
    ]);
  });

  it("keeps a server clear of bundled app addresses", () => {
    expect(getRemoteExperienceCatalog([{ ...source, server: "Sites" }])[0]?.slug).toBe(
      "sites-2/charades",
    );
  });

  it("keeps two servers whose labels slug the same apart", () => {
    const slugs = getRemoteExperienceCatalog([source, { ...source, server: "pashi-" }]).map(
      (app) => app.slug,
    );

    expect(new Set(slugs).size).toBe(2);
  });
});

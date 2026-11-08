import { describe, expect, it } from "vitest";

import {
  getRemoteExperienceCatalog,
  isRemoteAppId,
  remoteAppId,
} from "~/modules/capabilities/domain/app-catalogue";

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
    const source = {
      server: "Pashi",
      tool: "pashi_play_charades",
      resourceUri: "ui://pashi/charades",
      name: "Charades",
      layout: "workspace" as const,
    };

    expect(getRemoteExperienceCatalog([source, { ...source, server: "pashi" }])).toHaveLength(1);
  });
});

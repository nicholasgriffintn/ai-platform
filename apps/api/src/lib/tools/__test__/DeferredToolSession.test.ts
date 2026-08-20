import { describe, expect, it } from "vitest";

import { DeferredToolSession, type DeferredToolEntry } from "../DeferredToolSession";

function createEntry(
  name: string,
  group: string,
  origin: DeferredToolEntry["origin"],
): DeferredToolEntry {
  return { group, origin, definition: { name, description: `${name} description` } };
}

const entries: DeferredToolEntry[] = [
  createEntry("create_image", "Assistant tools", "function"),
  createEntry("create_video", "Assistant tools", "function"),
  createEntry("mcp_a1b2_create_issue", "GitHub", "external"),
];

describe("DeferredToolSession", () => {
  it("withholds everything in the catalogue until it is loaded", () => {
    const session = new DeferredToolSession(entries);

    expect(session.size).toBe(3);
    expect(session.isWithheld("create_image")).toBe(true);
    expect(session.withheldNames()).toHaveLength(3);
    expect(session.loadedDefinitions()).toEqual([]);
  });

  it("does not withhold a tool it has never heard of", () => {
    expect(new DeferredToolSession(entries).isWithheld("web_search")).toBe(false);
  });

  it("stops withholding once a tool is loaded", () => {
    const session = new DeferredToolSession(entries);

    expect(session.load(["create_image"])).toEqual(["create_image"]);
    expect(session.isWithheld("create_image")).toBe(false);
    expect(session.withheldNames()).toEqual(["create_video", "mcp_a1b2_create_issue"]);
  });

  it("ignores names outside the catalogue and repeat loads", () => {
    const session = new DeferredToolSession(entries);

    session.load(["create_image"]);

    expect(session.load(["create_image", "web_search"])).toEqual([]);
    expect(session.loadedDefinitions()).toHaveLength(1);
  });

  it("separates definitions the function registry owns from ones it does not", () => {
    const session = new DeferredToolSession(entries);

    session.load(["create_image", "mcp_a1b2_create_issue"]);

    expect(session.loadedDefinitions("function").map((entry) => entry.name)).toEqual([
      "create_image",
    ]);
    expect(session.loadedDefinitions("external").map((entry) => entry.name)).toEqual([
      "mcp_a1b2_create_issue",
    ]);
  });

  it("groups the catalogue by the source it came from", () => {
    expect(new DeferredToolSession(entries).groups()).toEqual([
      { name: "Assistant tools", toolNames: ["create_image", "create_video"] },
      { name: "GitHub", toolNames: ["mcp_a1b2_create_issue"] },
    ]);
  });
});

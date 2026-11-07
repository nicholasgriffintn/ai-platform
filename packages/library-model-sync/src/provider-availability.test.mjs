import { resolveCatalogueProvider } from "@ngriffin_uk/polychat-library-model-catalogue/schema";
import { afterEach, describe, expect, it, vi } from "vitest";

import { convertCatalogue } from "./catalogue-conversion.mjs";
import { syncCatalogue } from "./catalogue-sync.mjs";
import {
  fetchProviderModelLists,
  reconcileProviderAvailability,
} from "./provider-availability.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const model = (name) => ({ provider: "gateway", matchingModel: name, name, family: "test" });
const offering = (...offered) => ({
  label: "Gateway",
  isOffered: (id) => offered.includes(id),
});
const reconcile = (models, availability, remoteModels = {}) =>
  reconcileProviderAvailability({ provider: "gateway", models, remoteModels, availability });

describe("provider availability", () => {
  it("retires models a provider dropped, then restores them if they return", () => {
    const remote = { gateway: { models: { kept: { id: "kept", name: "kept", family: "test" } } } };
    const catalogue = convertCatalogue(
      { gateway: { kept: model("kept"), other: model("other"), gone: model("gone") } },
      remote,
    );
    const dropped = syncCatalogue(catalogue, remote, new Map(), new Set(), {
      gateway: offering("kept", "other"),
    });
    const retired = resolveCatalogueProvider(dropped.catalogue, "gateway").gone;

    expect(dropped.stats.retiredModels).toBe(1);
    expect(retired.deprecated).toBe(true);
    expect(retired.deprecationMessage).toBe("gone is no longer offered by Gateway.");

    const returned = syncCatalogue(dropped.catalogue, remote, new Map(), new Set(), {
      gateway: offering("kept", "other", "gone"),
    });
    const restored = resolveCatalogueProvider(returned.catalogue, "gateway").gone;

    expect(returned.stats.restoredModels).toBe(1);
    expect(restored.deprecated).toBeUndefined();
    expect(restored.deprecationMessage).toBeUndefined();
  });

  it("keeps a model models.dev still lists even when the provider list omits it", () => {
    const models = { listed: model("listed"), a: model("a"), b: model("b") };
    const result = reconcile(models, offering("a", "b"), { listed: { id: "listed" } });

    expect(result.retired).toBe(0);
    expect(result.models.listed.deprecated).toBeUndefined();
  });

  it("leaves a vendor retirement alone when the model is still listed", () => {
    const vendorRetired = {
      ...model("old"),
      deprecated: true,
      deprecationMessage: "Old shuts down on 1 January 2027.",
    };
    const result = reconcile({ old: vendorRetired }, offering("old"));

    expect(result.restored).toBe(0);
    expect(result.models.old.deprecated).toBe(true);
  });

  it("ignores a list that would retire most of a provider", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const models = { a: model("a"), b: model("b"), c: model("c") };
    const result = reconcile(models, offering("a"));

    expect(result.retired).toBe(0);
    expect(result.models).toBe(models);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("looks incomplete"));
  });

  it("reads each list shape and skips a provider whose list is unusable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const responses = {
      "https://list.test/data": Response.json({ data: [{ id: "Vendor/Model" }] }),
      "https://list.test/chat": Response.json({ data: [{ id: "vendor/chat" }] }),
      "https://list.test/tags": Response.json({ models: [{ name: "tagged:1b" }] }),
      "https://list.test/bare": Response.json({ data: [{ id: "vendor/shared" }] }),
      "https://list.test/flagged": Response.json([
        { model_name: "live" },
        { model_name: "dead", deprecated: 1790000000 },
      ]),
      "https://list.test/down": new Response("Unavailable", { status: 503 }),
      "https://list.test/empty": Response.json({ data: [] }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => responses[url]),
    );

    const lists = await fetchProviderModelLists({
      data: { label: "Data", url: "https://list.test/data" },
      tags: { label: "Tags", url: "https://list.test/tags" },
      bare: { label: "Bare", url: "https://list.test/bare", matchesBareIds: true },
      flagged: { label: "Flagged", url: "https://list.test/flagged" },
      chat: { label: "Chat", url: "https://list.test/chat", chatOnly: true },
      down: { label: "Down", url: "https://list.test/down" },
      empty: { label: "Empty", url: "https://list.test/empty" },
    });

    expect(Object.keys(lists).sort()).toEqual(["bare", "chat", "data", "flagged", "tags"]);
    expect(lists.bare.isOffered("shared")).toBe(true);
    expect(lists.bare.isOffered("other/shared")).toBe(false);
    expect(lists.data.isOffered("vendor/model")).toBe(true);
    expect(lists.tags.isOffered("tagged:1b")).toBe(true);
    expect(lists.flagged.isOffered("live")).toBe(true);
    expect(lists.flagged.isOffered("dead")).toBe(false);
    expect(lists.chat.isOffered("vendor/text-embed-1")).toBe(true);
    expect(lists.chat.isOffered("vendor/other-chat")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

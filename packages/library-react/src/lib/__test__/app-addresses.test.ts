import type { ProjectExperienceDefinition } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { resolveAppAddress } from "../app-addresses.js";

const app = (id: string, slug: string) => ({ id, slug }) as ProjectExperienceDefinition;

const apps = [
  app("sites", "sites"),
  app("mcp-pashi-pashi-play-charades-1a2b", "pashi/charades"),
  app("mcp-pashi-pashi-play-charades-2-9z", "pashi/charades-2"),
];

describe("resolveAppAddress", () => {
  it("opens a remote app at its readable address and keeps the rest as its subpath", () => {
    expect(resolveAppAddress(apps, "pashi/charades/round/3")).toEqual({
      app: apps[1],
      subpath: "round/3",
      isLegacy: false,
    });
  });

  it("does not let a slug match a longer segment that only shares its prefix", () => {
    expect(resolveAppAddress(apps, "pashi/charades-2")?.app).toBe(apps[2]);
  });

  it("marks an old hashed address as legacy so it can redirect", () => {
    expect(resolveAppAddress(apps, "mcp-pashi-pashi-play-charades-1a2b/round")).toEqual({
      app: apps[1],
      subpath: "round",
      isLegacy: true,
    });
  });

  it("finds nothing for an unknown address or a bare server", () => {
    expect(resolveAppAddress(apps, "pashi")).toBeUndefined();
    expect(resolveAppAddress(apps, "nowhere/charades")).toBeUndefined();
  });

  it("opens bundled apps whose address is their id", () => {
    expect(resolveAppAddress(apps, "sites/abc")).toEqual({
      app: apps[0],
      subpath: "abc",
      isLegacy: false,
    });
  });
});

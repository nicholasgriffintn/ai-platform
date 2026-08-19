import { describe, expect, it } from "vitest";

import { RegistryError } from "../errors";
import { CategoryRegistry } from "../registry";

interface Instance {
  id: string;
  serial: number;
}

interface Context {
  suffix: string;
}

type InstanceMap = {
  chat: Instance;
  image: Instance;
};

function createRegistry() {
  let serial = 0;

  const registry = new CategoryRegistry<InstanceMap, Context>();

  const register = (
    category: keyof InstanceMap,
    name: string,
    options: { aliases?: string[]; lifecycle?: "singleton" | "transient" } = {},
  ) => {
    registry.register(category, {
      name,
      aliases: options.aliases,
      lifecycle: options.lifecycle,
      create: (context) => ({ id: `${name}${context.suffix}`, serial: ++serial }),
    });
  };

  return { registry, register };
}

describe("CategoryRegistry", () => {
  it("rejects a duplicate name in the same category", () => {
    const { register } = createRegistry();

    register("chat", "openai");

    expect(() => register("chat", "OpenAI")).toThrowError(
      expect.objectContaining({
        code: "duplicate_registration",
        category: "chat",
        entryName: "OpenAI",
      }),
    );
  });

  it("allows the same name in a different category", () => {
    const { registry, register } = createRegistry();

    register("chat", "openai");
    register("image", "openai");

    expect(registry.resolve("image", "openai", { suffix: "!" }).id).toBe("openai!");
  });

  it("resolves through aliases and case-insensitively", () => {
    const { registry, register } = createRegistry();

    register("chat", "openai", { aliases: ["gpt", "OAI"] });

    expect(registry.resolve("chat", "OPENAI", { suffix: "" }).serial).toBe(1);
    expect(registry.resolve("chat", "gpt", { suffix: "" }).serial).toBe(1);
    expect(registry.resolve("chat", "oai", { suffix: "" }).serial).toBe(1);
  });

  it("caches singleton instances and recreates transient ones", () => {
    const { registry, register } = createRegistry();

    register("chat", "cached");
    register("chat", "fresh", { lifecycle: "transient" });

    expect(registry.resolve("chat", "cached", { suffix: "" }).serial).toBe(1);
    expect(registry.resolve("chat", "cached", { suffix: "" }).serial).toBe(1);
    expect(registry.resolve("chat", "fresh", { suffix: "" }).serial).toBe(2);
    expect(registry.resolve("chat", "fresh", { suffix: "" }).serial).toBe(3);
  });

  it("passes the resolve context into the factory", () => {
    const { registry, register } = createRegistry();

    register("chat", "openai", { lifecycle: "transient" });

    expect(registry.resolve("chat", "openai", { suffix: "-eu" }).id).toBe("openai-eu");
  });

  it("reports an unknown category separately from an unknown entry", () => {
    const { registry, register } = createRegistry();

    expect(() => registry.resolve("chat", "openai", { suffix: "" })).toThrowError(
      expect.objectContaining({ code: "unknown_category", category: "chat" }),
    );

    register("chat", "openai");

    expect(() => registry.resolve("chat", "missing", { suffix: "" })).toThrowError(
      expect.objectContaining({ code: "unknown_entry", entryName: "missing" }),
    );
  });

  it("throws RegistryError instances so hosts can map them", () => {
    const { registry } = createRegistry();

    expect(() => registry.resolve("chat", "openai", { suffix: "" })).toThrowError(RegistryError);
  });

  it("lists each entry once, sorted by name, regardless of aliases", () => {
    const { registry, register } = createRegistry();

    register("chat", "zeta", { aliases: ["z"] });
    register("chat", "alpha", { aliases: ["a", "aa"] });

    expect(registry.listEntries("chat").map((entry) => entry.name)).toEqual(["alpha", "zeta"]);
  });

  it("exposes the cached instance only after it has been resolved", () => {
    const { registry, register } = createRegistry();

    register("chat", "openai");

    expect(registry.listEntries("chat")[0].instance).toBeUndefined();

    registry.resolve("chat", "openai", { suffix: "" });

    expect(registry.listEntries("chat")[0].instance).toMatchObject({ id: "openai" });
  });

  it("lists every category when none is given", () => {
    const { registry, register } = createRegistry();

    register("chat", "openai");
    register("image", "ideogram");

    expect(registry.listEntries().map((entry) => entry.category)).toEqual(["chat", "image"]);
  });
});

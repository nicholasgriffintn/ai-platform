import { describe, expect, it, vi } from "vitest";

import { createNoteSaver } from "../note-saver";

const input = (content: string) => ({ title: "Hello", content, metadata: {} });

describe("createNoteSaver", () => {
  it("creates once when a second save lands before the first has finished", async () => {
    const create = vi.fn(
      async () =>
        new Promise<{ id: string }>((resolve) => setTimeout(() => resolve({ id: "note-1" }), 10)),
    );
    const update = vi.fn(async () => undefined);
    const saver = createNoteSaver({ create, update });

    const [first, second] = await Promise.all([
      saver.save(undefined, input("one")),
      saver.save(undefined, input("one two")),
    ]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(first).toBe("note-1");
    expect(second).toBe("note-1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-1", content: "one two" }),
    );
  });

  it("updates rather than creating again once the note has an id", async () => {
    const create = vi.fn(async () => ({ id: "note-1" }));
    const update = vi.fn(async () => undefined);
    const saver = createNoteSaver({ create, update });

    await saver.save(undefined, input("one"));
    await saver.save(undefined, input("one two"));

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("never creates when the route already names a note", async () => {
    const create = vi.fn(async () => ({ id: "unused" }));
    const update = vi.fn(async () => undefined);
    const saver = createNoteSaver({ create, update });

    expect(await saver.save("note-9", input("one"))).toBe("note-9");
    expect(create).not.toHaveBeenCalled();
  });

  it("tells the host once, so the route is not replaced on every keystroke", async () => {
    const onCreated = vi.fn();
    const saver = createNoteSaver({
      create: async () => ({ id: "note-1" }),
      update: async () => undefined,
      onCreated,
    });

    await saver.save(undefined, input("one"));
    await saver.save(undefined, input("one two"));

    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("lets a later save create again after the first create failed", async () => {
    const create = vi
      .fn<() => Promise<{ id: string }>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ id: "note-1" });
    const saver = createNoteSaver({ create, update: async () => undefined });

    await expect(saver.save(undefined, input("one"))).rejects.toThrow("offline");

    expect(await saver.save(undefined, input("one two"))).toBe("note-1");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("forgets the created note when the editor moves to a new one", async () => {
    const create = vi.fn(async () => ({ id: "note-1" }));
    const saver = createNoteSaver({ create, update: async () => undefined });

    await saver.save(undefined, input("one"));
    saver.reset();
    await saver.save(undefined, input("two"));

    expect(create).toHaveBeenCalledTimes(2);
  });
});

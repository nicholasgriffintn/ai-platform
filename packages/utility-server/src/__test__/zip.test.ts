import { strFromU8, strToU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { createZipStream, toArchiveName } from "../zip.js";

describe("createZipStream", () => {
  it("writes compressed and stored entries that unzip to the original bytes", async () => {
    const { stream, done } = createZipStream(async (zip) => {
      await zip.addEntry("data/a.json", [strToU8('{"a":'), strToU8("1}")], { compress: true });
      await zip.addEntry("files/b.txt", [strToU8("hello")]);
    });

    const archive = new Uint8Array(await new Response(stream).arrayBuffer());

    await done;

    const entries = unzipSync(archive);

    expect(strFromU8(entries["data/a.json"])).toBe('{"a":1}');
    expect(strFromU8(entries["files/b.txt"])).toBe("hello");
  });

  it("fails the stream rather than ending a partial archive cleanly", async () => {
    const { stream, done } = createZipStream(async (zip) => {
      await zip.addEntry("data/a.json", [strToU8("[]")]);
      throw new Error("read failed");
    });

    await expect(new Response(stream).arrayBuffer()).rejects.toThrow("read failed");
    await expect(done).rejects.toThrow("read failed");
  });
});

describe("toArchiveName", () => {
  it("keeps stored names inside their folder", () => {
    expect(toArchiveName("../../etc/passwd")).toBe("passwd");
    expect(toArchiveName("..\\..\\boot.ini")).toBe("boot.ini");
    expect(toArchiveName("..")).toBe("file");
    expect(toArchiveName(null)).toBe("file");
  });
});

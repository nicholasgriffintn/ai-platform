import { describe, expect, it } from "vitest";

import { toArchiveName } from "../zip.js";

describe("toArchiveName", () => {
  it("keeps stored names inside their folder", () => {
    expect(toArchiveName("../../etc/passwd")).toBe("passwd");
    expect(toArchiveName("..\\..\\boot.ini")).toBe("boot.ini");
    expect(toArchiveName("..")).toBe("file");
    expect(toArchiveName(null)).toBe("file");
  });
});

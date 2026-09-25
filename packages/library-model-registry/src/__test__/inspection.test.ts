import { describe, expect, it } from "vitest";

import {
  assessChatTemplate,
  parseSafetensorsHeader,
  readSafetensorsHeaderLength,
  scanPickle,
  scanPickleFile,
  summarisePickleScan,
} from "../index.js";

const hex = (value: string) => Uint8Array.from(Buffer.from(value, "hex"));

const PROTOCOL_4_OS_SYSTEM =
  "80049525000000000000008c05706f736978948c0673797374656d9493948c0a6563686f2070776e656494859452942e";
const PROTOCOL_0_OS_SYSTEM =
  "63706f7369780a73797374656d0a70300a28566563686f2070776e65640a70310a7470320a5270330a2e";
const PROTOCOL_5_ORDERED_DICTS =
  "80059539000000000000005d94288c0b636f6c6c656374696f6e73948c0b4f726465726564446963749493942952948c0161944b017368032952948c0162944b0273652e";
const DEFLATED_TORCH_ZIP =
  "504b03041400000008001476395d183bdf302c0000002a00000010000000617263686976652f646174612e706b6c6b604a2ec82fceace02aae2c2e49cde52a6488e0626060484dcec8572828cf4b4d29646c2d640a2a64d60300504b03041400000008001476395dd19e675504000000020000000f000000617263686976652f76657273696f6e33e60200504b010214031400000008001476395d183bdf302c0000002a000000100000000000000000000000800100000000617263686976652f646174612e706b6c504b010214031400000008001476395dd19e675504000000020000000f000000000000000000000080015a000000617263686976652f76657273696f6e504b050600000000020002007b0000008b0000000000";
const TORCH_STYLE_ZIP =
  "504b030414000000000097b9385d183bdf302a0000002a00000010000000617263686976652f646174612e706b6c800263706f7369780a73797374656d0a7100580a0000006563686f2070776e656471018571025271032e504b030414000000000097b9385dd19e675502000000020000000f000000617263686976652f76657273696f6e330a504b0102140314000000000097b9385d183bdf302a0000002a000000100000000000000000000000800100000000617263686976652f646174612e706b6c504b0102140314000000000097b9385dd19e675502000000020000000f0000000000000000000000800158000000617263686976652f76657273696f6e504b050600000000020002007b000000870000000000";

describe("scanPickle", () => {
  it("flags a STACK_GLOBAL import of os.system in protocol 4", () => {
    const result = scanPickle(hex(PROTOCOL_4_OS_SYSTEM));

    expect(summarisePickleScan(result).dangerous).toEqual(["posix.system"]);
    expect(result.error).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it("flags a GLOBAL import in a protocol 0 text pickle", () => {
    expect(summarisePickleScan(scanPickle(hex(PROTOCOL_0_OS_SYSTEM))).dangerous).toEqual([
      "posix.system",
    ]);
  });

  it("follows memoised strings and treats OrderedDict as safe", () => {
    const result = scanPickle(hex(PROTOCOL_5_ORDERED_DICTS));

    expect(result.imports).toEqual([{ module: "collections", name: "OrderedDict", risk: "safe" }]);
  });

  it("reports truncation instead of throwing when the sample ends mid-pickle", () => {
    const bytes = hex(PROTOCOL_4_OS_SYSTEM).subarray(0, 20);

    expect(scanPickle(bytes).truncated).toBe(true);
  });

  it("reports an unknown opcode as an error", () => {
    expect(scanPickle(Uint8Array.from([0x80, 0x02, 0xff])).error).toMatch(/Unknown opcode 0xff/);
  });
});

describe("scanPickleFile", () => {
  const inMemory = (path: string, bytes: Uint8Array) => ({
    path,
    size: bytes.byteLength,
    read: async (start: number, end: number) => bytes.subarray(start, end),
  });

  it("finds data.pkl in stored and deflated torch archives", async () => {
    for (const archive of [TORCH_STYLE_ZIP, DEFLATED_TORCH_ZIP]) {
      const scans = await scanPickleFile(inMemory("pytorch_model.bin", hex(archive)));

      expect(scans.map((scan) => scan.label)).toEqual(["pytorch_model.bin:archive/data.pkl"]);
      expect(summarisePickleScan(scans[0].result).dangerous).toEqual(["posix.system"]);
    }
  });

  it("scans a bare pickle file directly", async () => {
    const scans = await scanPickleFile(inMemory("weights.pkl", hex(PROTOCOL_0_OS_SYSTEM)));

    expect(summarisePickleScan(scans[0].result).dangerous).toEqual(["posix.system"]);
  });
});

describe("safetensors header", () => {
  const encode = (header: object) => new TextEncoder().encode(JSON.stringify(header));

  it("counts parameters and accepts a well-formed header", () => {
    const header = encode({
      __metadata__: { format: "pt" },
      "a.weight": { dtype: "BF16", shape: [2, 3], data_offsets: [0, 12] },
      "a.bias": { dtype: "F32", shape: [3], data_offsets: [12, 24] },
    });
    const summary = parseSafetensorsHeader(header, 8 + header.byteLength + 24);

    expect(summary).toMatchObject({ tensorCount: 2, parameterCount: 9, issues: [] });
    expect(summary.dtypes).toEqual({ BF16: 1, F32: 1 });
  });

  it("reports overlapping ranges, size mismatches and trailing bytes", () => {
    const header = encode({
      a: { dtype: "F32", shape: [4], data_offsets: [0, 16] },
      b: { dtype: "F32", shape: [4], data_offsets: [8, 20] },
    });
    const issues = parseSafetensorsHeader(header, 8 + header.byteLength + 64).issues;

    expect(issues).toContain("Tensor b byte range does not match its shape");
    expect(issues).toContain("Tensor byte ranges overlap");
    expect(issues).toContain("44 trailing bytes follow the tensor data");
  });

  it("rejects an implausible header length", () => {
    const prefix = new Uint8Array(8);

    new DataView(prefix.buffer).setBigUint64(0, 2n ** 40n, true);

    expect(() => readSafetensorsHeaderLength(prefix)).toThrow(/invalid/);
  });
});

describe("assessChatTemplate", () => {
  it("fails templates that reach for Python internals", () => {
    const result = assessChatTemplate("{{ cycler.__init__.__globals__.os.popen('id').read() }}");

    expect(result.status).toBe("fail");
  });

  it("passes an ordinary chat template", () => {
    expect(
      assessChatTemplate(
        "{% for message in messages %}<|{{ message.role }}|>{{ message.content }}{% endfor %}",
      ).status,
    ).toBe("pass");
  });
});

import { ByteCursor, ByteCursorOverflowError } from "@ngriffin_uk/polychat-utility-core";

export type PickleImportRisk = "safe" | "unknown" | "dangerous";

export interface PickleImport {
  module: string;
  name: string;
  risk: PickleImportRisk;
}

export interface PickleScanResult {
  imports: PickleImport[];
  opcodeCount: number;
  truncated: boolean;
  error: string | null;
}

const SAFE_GLOBALS = new Set([
  "collections.OrderedDict",
  "collections.defaultdict",
  "torch._utils._rebuild_tensor",
  "torch._utils._rebuild_tensor_v2",
  "torch._utils._rebuild_tensor_v3",
  "torch._utils._rebuild_parameter",
  "torch._utils._rebuild_parameter_with_state",
  "torch._utils._rebuild_qtensor",
  "torch._utils._rebuild_sparse_tensor",
  "torch._utils._rebuild_device_tensor_from_numpy",
  "torch._tensor._rebuild_from_type_v2",
  "torch.Size",
  "torch.device",
  "torch.dtype",
  "torch.bfloat16",
  "torch.float16",
  "torch.float32",
  "torch.int64",
  "torch.serialization._get_layout",
  "numpy.core.multiarray._reconstruct",
  "numpy._core.multiarray._reconstruct",
  "numpy.core.multiarray.scalar",
  "numpy._core.multiarray.scalar",
  "numpy.ndarray",
  "numpy.dtype",
  "_codecs.encode",
  "builtins.set",
  "builtins.frozenset",
  "builtins.slice",
  "builtins.bytearray",
  "__builtin__.set",
]);

const SAFE_NAME_PATTERNS = [/^torch\.[A-Za-z]*Storage$/, /^numpy\.dtypes\.[A-Za-z0-9]+DType$/];

const DANGEROUS_MODULES = new Set([
  "os",
  "posix",
  "nt",
  "subprocess",
  "sys",
  "socket",
  "shutil",
  "runpy",
  "pty",
  "platform",
  "webbrowser",
  "requests",
  "httplib",
  "http",
  "urllib",
  "ctypes",
  "importlib",
  "pickle",
  "_pickle",
  "dill",
  "marshal",
  "code",
  "types",
  "asyncio",
  "multiprocessing",
  "tempfile",
  "pathlib",
  "zipfile",
  "bdb",
  "pdb",
  "timeit",
]);

const DANGEROUS_BUILTINS = new Set([
  "eval",
  "exec",
  "execfile",
  "compile",
  "open",
  "getattr",
  "setattr",
  "delattr",
  "__import__",
  "globals",
  "locals",
  "vars",
  "input",
  "breakpoint",
  "apply",
]);

export function classifyPickleImport(module: string, name: string): PickleImportRisk {
  const qualified = `${module}.${name}`;
  const rootModule = module.split(".")[0];

  if (
    SAFE_GLOBALS.has(qualified) ||
    SAFE_NAME_PATTERNS.some((pattern) => pattern.test(qualified))
  ) {
    return "safe";
  }

  if (DANGEROUS_MODULES.has(rootModule)) {
    return "dangerous";
  }

  if ((rootModule === "builtins" || rootModule === "__builtin__") && DANGEROUS_BUILTINS.has(name)) {
    return "dangerous";
  }

  if (rootModule === "torch" && /(load|hub|jit|_C\.|ops|library|compile)/.test(qualified)) {
    return "dangerous";
  }

  return "unknown";
}

type StackValue = string | null;

const FIXED_ARGUMENT_BYTES: Record<number, number> = {
  0x4a: 4,
  0x4b: 1,
  0x4d: 2,
  0x68: 1,
  0x6a: 4,
  0x71: 1,
  0x72: 4,
  0x47: 8,
  0x80: 1,
  0x82: 1,
  0x83: 2,
  0x84: 4,
  0x95: 8,
};

const NO_ARGUMENT_OPCODES = new Set([
  0x28, 0x30, 0x31, 0x32, 0x4e, 0x51, 0x52, 0x61, 0x62, 0x64, 0x7d, 0x65, 0x6c, 0x5d, 0x6f, 0x73,
  0x74, 0x29, 0x75, 0x81, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8f, 0x90, 0x91, 0x92, 0x97, 0x98,
]);

const NEWLINE_ARGUMENT_OPCODES = new Set([0x46, 0x49, 0x4c, 0x50]);

export function scanPickle(
  bytes: Uint8Array,
  { maxPickles = 1 }: { maxPickles?: number } = {},
): PickleScanResult {
  const cursor = new ByteCursor(bytes);
  const found = new Map<string, PickleImport>();
  const memo = new Map<number, StackValue>();
  const stack: StackValue[] = [];
  let opcodeCount = 0;
  let completedPickles = 0;

  const record = (module: string, name: string) => {
    const key = `${module}.${name}`;

    if (!found.has(key)) {
      found.set(key, { module, name, risk: classifyPickleImport(module, name) });
    }
  };

  const push = (value: StackValue) => {
    stack.push(value);

    if (stack.length > 64) {
      stack.shift();
    }
  };

  const top = (): StackValue => stack[stack.length - 1] ?? null;
  const finish = (truncated: boolean, error: string | null): PickleScanResult => ({
    imports: [...found.values()],
    opcodeCount,
    truncated,
    error,
  });

  try {
    while (cursor.remaining > 0) {
      const opcode = cursor.u8();

      opcodeCount += 1;

      if (opcode === 0x2e) {
        completedPickles += 1;

        if (completedPickles >= maxPickles) {
          return finish(false, null);
        }

        stack.length = 0;
        memo.clear();
        continue;
      }

      if (NO_ARGUMENT_OPCODES.has(opcode)) {
        push(null);
        continue;
      }

      const fixed = FIXED_ARGUMENT_BYTES[opcode];

      if (fixed !== undefined) {
        const start = cursor.offset;

        cursor.skip(fixed);

        if (opcode === 0x68 || opcode === 0x6a) {
          const index = opcode === 0x68 ? bytes[start] : readU32(bytes, start);

          push(memo.get(index) ?? null);
        } else if (opcode === 0x71 || opcode === 0x72) {
          const index = opcode === 0x71 ? bytes[start] : readU32(bytes, start);

          memo.set(index, top());
        } else if (opcode !== 0x80 && opcode !== 0x95) {
          push(null);
        }

        continue;
      }

      if (NEWLINE_ARGUMENT_OPCODES.has(opcode)) {
        cursor.line();
        push(null);
        continue;
      }

      switch (opcode) {
        case 0x63:
        case 0x69: {
          const module = cursor.line();
          const name = cursor.line();

          record(module, name);
          push(null);
          break;
        }

        case 0x93: {
          const name = stack.pop() ?? null;
          const module = stack.pop() ?? null;

          record(module ?? "<dynamic>", name ?? "<dynamic>");
          push(null);
          break;
        }

        case 0x94:
          memo.set(memo.size, top());
          break;
        case 0x70:
          memo.set(Number.parseInt(cursor.line(), 10), top());
          break;
        case 0x67:
          push(memo.get(Number.parseInt(cursor.line(), 10)) ?? null);
          break;
        case 0x53:
        case 0x56:
          push(stripPickleQuotes(cursor.line()));
          break;
        case 0x55:
        case 0x8c:
          push(cursor.text(cursor.u8()));
          break;

        case 0x54:
        case 0x58:
          push(cursor.text(cursor.u32()));
          break;

        case 0x8d:
          push(cursor.text(cursor.u64()));
          break;

        case 0x43:
          cursor.skip(cursor.u8());
          push(null);
          break;

        case 0x42:
          cursor.skip(cursor.u32());
          push(null);
          break;

        case 0x8e:
        case 0x96:
          cursor.skip(cursor.u64());
          push(null);
          break;

        case 0x8a:
          cursor.skip(cursor.u8());
          push(null);
          break;
        case 0x8b:
          cursor.skip(cursor.i32());
          push(null);
          break;
        default:
          if (completedPickles > 0) {
            return finish(false, null);
          }

          return finish(false, `Unknown opcode 0x${opcode.toString(16)} at ${cursor.offset - 1}`);
      }
    }
  } catch (error) {
    if (error instanceof ByteCursorOverflowError) {
      return finish(true, null);
    }

    throw error;
  }

  return finish(true, null);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function stripPickleQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

export function summarisePickleScan(result: PickleScanResult): {
  dangerous: string[];
  unknown: string[];
} {
  const names = (risk: PickleImportRisk) =>
    result.imports
      .filter((item) => item.risk === risk)
      .map((item) => `${item.module}.${item.name}`);

  return { dangerous: names("dangerous"), unknown: names("unknown") };
}

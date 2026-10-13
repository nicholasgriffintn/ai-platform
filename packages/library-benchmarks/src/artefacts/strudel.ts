import { extractFencedBlock } from "../answers.js";

export const MAX_STRUDEL_CHARACTERS = 4_000;

export const STRUDEL_FUNCTIONS = [
  "arrange",
  "cat",
  "choose",
  "chooseCycles",
  "chord",
  "cosine",
  "fastcat",
  "irand",
  "isaw",
  "m",
  "mini",
  "n",
  "note",
  "perlin",
  "polymeter",
  "pure",
  "rand",
  "run",
  "s",
  "saw",
  "seq",
  "sequence",
  "setcpm",
  "setcps",
  "silence",
  "sine",
  "slowcat",
  "sound",
  "square",
  "stack",
  "timeCat",
  "tri",
  "wchoose",
] as const;

const ALLOWED_GLOBALS = new Set<string>(STRUDEL_FUNCTIONS);
const BLOCKED_PROPERTIES = new Set([
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "__proto__",
  "apply",
  "arguments",
  "bind",
  "call",
  "callee",
  "caller",
  "constructor",
  "prototype",
]);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/;
const NUMBER = /^(?:\d+\.?\d*|\.\d+)/;
const STRING_CONTENT = /^[a-zA-Z0-9~*/!?[\]@<>(),:._^\-\s|{}%#'+=]*$/;
const PUNCTUATION = new Set(["(", ")", ",", ".", "+", "-", "*", "/", ":"]);

export interface StrudelCheck {
  ok: boolean;
  reasons: string[];
}

export function extractStrudelCode(output: string): string | null {
  const code = extractFencedBlock(output, ["js", "javascript", "strudel"]) ?? output.trim();

  return code.length > 0 ? code : null;
}

function readString(code: string, start: number): number | null {
  const quote = code[start];
  const end = code.indexOf(quote, start + 1);

  if (end === -1) {
    return null;
  }

  const content = code.slice(start + 1, end);

  return STRING_CONTENT.test(content) && !content.includes(quote) ? end + 1 : null;
}

export function checkStrudelCode(code: string): StrudelCheck {
  const reasons = new Set<string>();
  let index = 0;
  let previous = "";

  if (code.length > MAX_STRUDEL_CHARACTERS) {
    reasons.add("over 4,000 characters");
  }

  while (index < code.length) {
    const rest = code.slice(index);
    const character = code[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (rest.startsWith("//")) {
      const lineEnd = code.indexOf("\n", index);

      index = lineEnd === -1 ? code.length : lineEnd;
      continue;
    }

    if (character === '"' || character === "'") {
      const end = readString(code, index);

      if (end === null) {
        reasons.add("unsupported string");
        break;
      }

      index = end;
      previous = "string";
      continue;
    }

    if (rest.startsWith("$:")) {
      index += 2;
      previous = ":";
      continue;
    }

    const identifier = IDENTIFIER.exec(rest)?.[0];

    if (identifier) {
      if (previous === ".") {
        if (BLOCKED_PROPERTIES.has(identifier)) {
          reasons.add(`blocked property ${identifier}`);
        }
      } else if (!ALLOWED_GLOBALS.has(identifier)) {
        reasons.add(`unknown function ${identifier}`);
      }

      index += identifier.length;
      previous = "identifier";
      continue;
    }

    const number = NUMBER.exec(rest)?.[0];

    if (number) {
      index += number.length;
      previous = "number";
      continue;
    }

    if (PUNCTUATION.has(character)) {
      index += 1;
      previous = character;
      continue;
    }

    reasons.add(`unsupported character ${character}`);
    index += 1;
  }

  return { ok: reasons.size === 0, reasons: [...reasons] };
}

import {
  parse,
  type ArrowFunctionExpression,
  type Expression,
  type Literal,
  type MemberExpression,
  type ModuleDeclaration,
  type PrivateIdentifier,
  type SpreadElement,
  type Statement,
  type Super,
} from "acorn";

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

export const STRUDEL_TRANSFORMS = [
  "add",
  "chop",
  "degrade",
  "div",
  "early",
  "euclid",
  "fast",
  "hurry",
  "iter",
  "jux",
  "late",
  "linger",
  "mul",
  "palindrome",
  "ply",
  "press",
  "range",
  "rev",
  "segment",
  "slow",
  "striate",
  "struct",
  "sub",
  "superimpose",
] as const;

const ALLOWED_GLOBALS = new Set<string>([...STRUDEL_FUNCTIONS, ...STRUDEL_TRANSFORMS]);
const GLOBAL_ONLY = new Set(["setcpm", "setcps", "samples", "hush"]);
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
const LAYER_LABEL = "$";
const NUMERIC_OPERATORS = new Set(["+", "-", "*", "/"]);
const STRING_CONTENT = /^[a-zA-Z0-9~*/!?[\]@<>(),:._^\-\s|{}%#'+=]*$/;

type Operand = Expression | Super | PrivateIdentifier | SpreadElement;

export interface StrudelCheck {
  ok: boolean;
  reasons: string[];
}

export function extractStrudelCode(output: string): string | null {
  const code = extractFencedBlock(output, ["js", "javascript", "strudel"]) ?? output.trim();

  return code.length > 0 ? code : null;
}

function isNumeric(node: Operand): boolean {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "number";
    case "UnaryExpression":
      return node.operator === "-" && isNumeric(node.argument);
    case "BinaryExpression":
      return NUMERIC_OPERATORS.has(node.operator) && isNumeric(node.left) && isNumeric(node.right);
    default:
      return false;
  }
}

class Checker {
  readonly reasons = new Set<string>();

  statement(node: Statement | ModuleDeclaration): void {
    switch (node.type) {
      case "LabeledStatement":
        if (node.label.name !== LAYER_LABEL) {
          this.reasons.add(`unknown label ${node.label.name}`);
        }

        this.statement(node.body);

        return;
      case "ExpressionStatement":
        this.expression(node.expression, new Set());

        return;
      case "VariableDeclaration":
        this.reasons.add("variables are not allowed");

        return;
      default:
        this.reasons.add(`unsupported statement ${node.type}`);
    }
  }

  expression(node: Operand, locals: ReadonlySet<string>): void {
    switch (node.type) {
      case "CallExpression":
        this.expression(node.callee, locals);

        for (const argument of node.arguments) {
          this.expression(argument, locals);
        }

        return;
      case "MemberExpression":
        this.member(node, locals);

        return;
      case "Identifier":
        if (!ALLOWED_GLOBALS.has(node.name) && !locals.has(node.name)) {
          this.reasons.add(`unknown function ${node.name}`);
        }

        return;
      case "Literal":
        this.literal(node);

        return;
      case "TemplateLiteral":
        this.reasons.add("template strings are not allowed");

        return;
      case "ArrayExpression":
        this.reasons.add("square brackets only belong inside mini-notation strings");

        return;
      case "UnaryExpression":
      case "BinaryExpression":
        if (!isNumeric(node)) {
          this.reasons.add("arithmetic only works on plain numbers");
        }

        return;
      case "ArrowFunctionExpression":
        this.arrow(node, locals);

        return;
      case "ParenthesizedExpression":
        this.expression(node.expression, locals);

        return;
      default:
        this.reasons.add(`unsupported syntax ${node.type}`);
    }
  }

  private member(node: MemberExpression, locals: ReadonlySet<string>): void {
    const property = node.property;

    if (node.computed || property.type !== "Identifier") {
      this.reasons.add("computed properties are not allowed");
    } else if (BLOCKED_PROPERTIES.has(property.name)) {
      this.reasons.add(`blocked property ${property.name}`);
    } else if (GLOBAL_ONLY.has(property.name)) {
      this.reasons.add(`${property.name} is not a method: call it on its own line`);
    }

    this.expression(node.object, locals);
  }

  private arrow(node: ArrowFunctionExpression, locals: ReadonlySet<string>): void {
    const names = node.params.map((param) => (param.type === "Identifier" ? param.name : null));

    if (!node.expression || node.body.type === "BlockStatement" || names.includes(null)) {
      this.reasons.add("arrow functions must be a single expression with plain parameters");

      return;
    }

    this.expression(
      node.body,
      new Set([...locals, ...names.filter((name): name is string => name !== null)]),
    );
  }

  private literal(node: Literal): void {
    const { value } = node;

    if (typeof value === "number") {
      return;
    }

    if (typeof value !== "string") {
      this.reasons.add(`unsupported literal ${node.raw ?? String(value)}`);

      return;
    }

    if (value.includes('"') || value.includes("'")) {
      this.reasons.add("quotes nested inside mini-notation: group with [ ] instead");

      return;
    }

    if (!STRING_CONTENT.test(value)) {
      this.reasons.add("unsupported string");
    }
  }
}

export function checkStrudelCode(code: string): StrudelCheck {
  const checker = new Checker();

  if (code.length > MAX_STRUDEL_CHARACTERS) {
    checker.reasons.add("over 4,000 characters");
  }

  try {
    for (const statement of parse(code, { ecmaVersion: 2022, sourceType: "script" }).body) {
      checker.statement(statement);
    }
  } catch (error) {
    checker.reasons.add(
      `does not parse: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  return { ok: checker.reasons.size === 0, reasons: [...checker.reasons] };
}

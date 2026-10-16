import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import { CALCULATOR_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import { MAX_ARITHMETIC_EXPRESSION_LENGTH } from "@ngriffin_uk/polychat-utility-core";

import type { FunctionToolDescriptor } from "./types";

export const calculate: FunctionToolDescriptor = {
  name: CALCULATOR_TOOL_NAME,
  description:
    "Evaluates an arithmetic expression exactly. Use it for any calculation beyond trivial mental arithmetic rather than working it out in text. Supports + - * / % ^, parentheses, the constants pi, e and tau, and the functions abs, sqrt, cbrt, pow, exp, ln, log (base 10), log2, round, floor, ceil, trunc, sign, min, max, hypot, sin, cos, tan, asin, acos, atan and atan2 (radians).",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: 'The expression to evaluate, for example "(1250 * 0.2) + sqrt(81)".',
        maxLength: MAX_ARITHMETIC_EXPRESSION_LENGTH,
      },
    },
    required: ["expression"],
  }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};

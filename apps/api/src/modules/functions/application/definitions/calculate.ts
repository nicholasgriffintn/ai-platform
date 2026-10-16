import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import { CALCULATOR_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import { MAX_ARITHMETIC_EXPRESSION_LENGTH } from "@ngriffin_uk/polychat-utility-core";

import type { FunctionToolDescriptor } from "./types";

export const calculate: FunctionToolDescriptor = {
  name: CALCULATOR_TOOL_NAME,
  description:
    "Evaluates an arithmetic expression exactly; use it instead of mental arithmetic for anything non-trivial. Supports + - * / ^ ( ), % as remainder (-5 % 3 = -2), pi, e, and common Math functions such as sqrt, ln, log (base 10), round, min, max and trig in radians.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: 'For example "(1250 * 0.2) + sqrt(81)".',
        maxLength: MAX_ARITHMETIC_EXPRESSION_LENGTH,
      },
    },
    required: ["expression"],
  }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};

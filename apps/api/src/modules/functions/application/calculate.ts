import { ArithmeticExpressionError, evaluateArithmetic } from "@ngriffin_uk/polychat-utility-core";

import type { ApiToolDefinition } from "~/types/functions";

import { calculate as calculateDescriptor } from "./definitions/calculate";

export const calculate: ApiToolDefinition = {
  ...calculateDescriptor,
  execute: async (args) => {
    const expression = typeof args.expression === "string" ? args.expression.trim() : "";

    try {
      const result = evaluateArithmetic(expression);

      return {
        status: "success",
        name: calculateDescriptor.name,
        content: `${expression} = ${result}`,
        data: { expression, result },
      };
    } catch (error) {
      if (!(error instanceof ArithmeticExpressionError)) {
        throw error;
      }

      return {
        status: "error",
        name: calculateDescriptor.name,
        content: `Could not evaluate "${expression}": ${error.message}`,
        data: { expression },
      };
    }
  },
};

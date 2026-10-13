export type CountdownEvaluation = { ok: true; value: number } | { ok: false; reason: string };

type Token = { kind: "number"; value: number } | { kind: "operator"; value: string };

const MAX_EXPRESSION_LENGTH = 200;
const OPERATOR_ALIASES: Record<string, string> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "×": "*",
  x: "*",
  X: "*",
  "/": "/",
  "÷": "/",
  "(": "(",
  ")": ")",
};

class CountdownRuleError extends Error {}

function tokenise(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    const digits = /^\d+/.exec(expression.slice(index))?.[0];

    if (digits) {
      tokens.push({ kind: "number", value: Number(digits) });
      index += digits.length;
      continue;
    }

    const operator = OPERATOR_ALIASES[character];

    if (!operator) {
      throw new CountdownRuleError(`Unexpected "${character}"`);
    }

    tokens.push({ kind: "operator", value: operator });
    index += 1;
  }

  return tokens;
}

function applyOperator(operator: string, left: number, right: number): number {
  if (operator === "+") {
    return left + right;
  }

  if (operator === "*") {
    return left * right;
  }

  if (operator === "-") {
    if (left - right <= 0) {
      throw new CountdownRuleError("Subtraction must stay positive");
    }

    return left - right;
  }

  if (right === 0 || left % right !== 0) {
    throw new CountdownRuleError("Division must be exact");
  }

  return left / right;
}

export function evaluateCountdownExpression(
  expression: string,
  available: readonly number[],
): CountdownEvaluation {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, reason: "Expression is too long" };
  }

  try {
    const tokens = tokenise(expression);
    const remaining = [...available];
    let position = 0;

    const peek = () => tokens[position];

    const parsePrimary = (): number => {
      const token = tokens[position];

      if (!token) {
        throw new CountdownRuleError("Expression ends early");
      }

      position += 1;

      if (token.kind === "number") {
        const slot = remaining.indexOf(token.value);

        if (slot === -1) {
          throw new CountdownRuleError(`${token.value} is not available`);
        }

        remaining.splice(slot, 1);

        return token.value;
      }

      if (token.value !== "(") {
        throw new CountdownRuleError(`Unexpected "${token.value}"`);
      }

      const value = parseSum();

      if (peek()?.value !== ")") {
        throw new CountdownRuleError("Missing closing bracket");
      }

      position += 1;

      return value;
    };

    const parseProduct = (): number => {
      let value = parsePrimary();

      while (peek()?.kind === "operator" && (peek()?.value === "*" || peek()?.value === "/")) {
        const operator = String(tokens[position].value);

        position += 1;
        value = applyOperator(operator, value, parsePrimary());
      }

      return value;
    };

    const parseSum = (): number => {
      let value = parseProduct();

      while (peek()?.kind === "operator" && (peek()?.value === "+" || peek()?.value === "-")) {
        const operator = String(tokens[position].value);

        position += 1;
        value = applyOperator(operator, value, parseProduct());
      }

      return value;
    };

    const value = parseSum();

    if (position !== tokens.length) {
      return { ok: false, reason: "Unexpected trailing input" };
    }

    return { ok: true, value };
  } catch (error) {
    if (error instanceof CountdownRuleError) {
      return { ok: false, reason: error.message };
    }

    throw error;
  }
}

export function countdownPoints(target: number, value: number): number {
  const distance = Math.abs(target - value);

  if (distance === 0) {
    return 10;
  }

  if (distance <= 5) {
    return 7;
  }

  return distance <= 10 ? 5 : 0;
}

export const MAX_ARITHMETIC_EXPRESSION_LENGTH = 1000;

const ARITHMETIC_CONSTANTS: ReadonlyMap<string, number> = new Map([
  ["pi", Math.PI],
  ["e", Math.E],
  ["tau", Math.PI * 2],
]);

const ARITHMETIC_FUNCTIONS: ReadonlyMap<string, (...args: number[]) => number> = new Map([
  ["abs", Math.abs],
  ["acos", Math.acos],
  ["asin", Math.asin],
  ["atan", Math.atan],
  ["atan2", Math.atan2],
  ["cbrt", Math.cbrt],
  ["ceil", Math.ceil],
  ["cos", Math.cos],
  ["exp", Math.exp],
  ["floor", Math.floor],
  ["hypot", Math.hypot],
  ["ln", Math.log],
  ["log", Math.log10],
  ["log2", Math.log2],
  ["max", Math.max],
  ["min", Math.min],
  ["pow", Math.pow],
  ["round", Math.round],
  ["sign", Math.sign],
  ["sin", Math.sin],
  ["sqrt", Math.sqrt],
  ["tan", Math.tan],
  ["trunc", Math.trunc],
]);

type ArithmeticToken =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "symbol"; value: string };

export class ArithmeticExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArithmeticExpressionError";
  }
}

const TOKEN_PATTERN =
  /\s*(?:(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z_][a-z0-9_]*)|(\*\*|[-+*/%^(),]))/iy;

function tokeniseArithmetic(expression: string): ArithmeticToken[] {
  const tokens: ArithmeticToken[] = [];

  TOKEN_PATTERN.lastIndex = 0;

  while (TOKEN_PATTERN.lastIndex < expression.length) {
    if (/^\s*$/.test(expression.slice(TOKEN_PATTERN.lastIndex))) {
      break;
    }

    const start = TOKEN_PATTERN.lastIndex;
    const match = TOKEN_PATTERN.exec(expression);

    if (!match) {
      throw new ArithmeticExpressionError(
        `Unexpected character "${expression.slice(start).trim()[0]}" at position ${start + 1}`,
      );
    }

    if (match[1] !== undefined) {
      tokens.push({ kind: "number", value: Number(match[1]) });
    } else if (match[2] !== undefined) {
      tokens.push({ kind: "name", value: match[2].toLowerCase() });
    } else {
      tokens.push({ kind: "symbol", value: match[3] === "**" ? "^" : match[3] });
    }
  }

  return tokens;
}

export function evaluateArithmetic(expression: string): number {
  if (expression.length > MAX_ARITHMETIC_EXPRESSION_LENGTH) {
    throw new ArithmeticExpressionError(
      `Expressions are limited to ${MAX_ARITHMETIC_EXPRESSION_LENGTH} characters`,
    );
  }

  const tokens = tokeniseArithmetic(expression);
  let position = 0;

  const peekSymbol = (): string | undefined => {
    const token = tokens[position];

    return token?.kind === "symbol" ? token.value : undefined;
  };

  const expectSymbol = (symbol: string): void => {
    if (peekSymbol() !== symbol) {
      throw new ArithmeticExpressionError(`Expected "${symbol}"`);
    }

    position += 1;
  };

  const parseExpression = (): number => {
    let value = parseTerm();

    while (peekSymbol() === "+" || peekSymbol() === "-") {
      const operator = peekSymbol();

      position += 1;
      const right = parseTerm();

      value = operator === "+" ? value + right : value - right;
    }

    return value;
  };

  const parseTerm = (): number => {
    let value = parseUnary();

    while (peekSymbol() === "*" || peekSymbol() === "/" || peekSymbol() === "%") {
      const operator = peekSymbol();

      position += 1;
      const right = parseUnary();

      if ((operator === "/" || operator === "%") && right === 0) {
        throw new ArithmeticExpressionError("Division by zero");
      }

      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }

    return value;
  };

  const parseUnary = (): number => {
    if (peekSymbol() === "-") {
      position += 1;

      return -parseUnary();
    }

    if (peekSymbol() === "+") {
      position += 1;

      return parseUnary();
    }

    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePrimary();

    if (peekSymbol() !== "^") {
      return base;
    }

    position += 1;

    return base ** parseUnary();
  };

  const parsePrimary = (): number => {
    const token = tokens[position];

    if (!token) {
      throw new ArithmeticExpressionError("Unexpected end of expression");
    }

    position += 1;

    if (token.kind === "number") {
      return token.value;
    }

    if (token.kind === "symbol") {
      if (token.value !== "(") {
        throw new ArithmeticExpressionError(`Unexpected "${token.value}"`);
      }

      const value = parseExpression();

      expectSymbol(")");

      return value;
    }

    if (peekSymbol() !== "(") {
      const constant = ARITHMETIC_CONSTANTS.get(token.value);

      if (constant === undefined) {
        throw new ArithmeticExpressionError(`Unknown constant "${token.value}"`);
      }

      return constant;
    }

    const fn = ARITHMETIC_FUNCTIONS.get(token.value);

    if (!fn) {
      throw new ArithmeticExpressionError(`Unknown function "${token.value}"`);
    }

    position += 1;
    const args: number[] = [];

    if (peekSymbol() !== ")") {
      args.push(parseExpression());

      while (peekSymbol() === ",") {
        position += 1;
        args.push(parseExpression());
      }
    }

    expectSymbol(")");

    return fn(...args);
  };

  if (tokens.length === 0) {
    throw new ArithmeticExpressionError("Expression is empty");
  }

  const result = parseExpression();

  if (position < tokens.length) {
    throw new ArithmeticExpressionError("Unexpected input after the expression");
  }

  if (!Number.isFinite(result)) {
    throw new ArithmeticExpressionError("Result is not a finite number");
  }

  return result;
}

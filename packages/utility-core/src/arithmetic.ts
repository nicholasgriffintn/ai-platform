export const MAX_ARITHMETIC_EXPRESSION_LENGTH = 1000;
export const MAX_ARITHMETIC_NESTING_DEPTH = 100;

interface ArithmeticFunction {
  minArgs: number;
  maxArgs: number;
  apply: (args: readonly number[]) => number;
}

const unary = (fn: (value: number) => number): ArithmeticFunction => ({
  minArgs: 1,
  maxArgs: 1,
  apply: ([value]) => fn(value),
});

const binary = (fn: (left: number, right: number) => number): ArithmeticFunction => ({
  minArgs: 2,
  maxArgs: 2,
  apply: ([left, right]) => fn(left, right),
});

const variadic = (fn: (...values: number[]) => number): ArithmeticFunction => ({
  minArgs: 1,
  maxArgs: Number.POSITIVE_INFINITY,
  apply: (args) => fn(...args),
});

const ARITHMETIC_CONSTANTS: ReadonlyMap<string, number> = new Map([
  ["pi", Math.PI],
  ["e", Math.E],
  ["tau", Math.PI * 2],
]);

const ARITHMETIC_FUNCTIONS: ReadonlyMap<string, ArithmeticFunction> = new Map([
  ["abs", unary(Math.abs)],
  ["acos", unary(Math.acos)],
  ["asin", unary(Math.asin)],
  ["atan", unary(Math.atan)],
  ["atan2", binary(Math.atan2)],
  ["cbrt", unary(Math.cbrt)],
  ["ceil", unary(Math.ceil)],
  ["cos", unary(Math.cos)],
  ["exp", unary(Math.exp)],
  ["floor", unary(Math.floor)],
  ["hypot", variadic(Math.hypot)],
  ["ln", unary(Math.log)],
  ["log", unary(Math.log10)],
  ["log2", unary(Math.log2)],
  ["max", variadic(Math.max)],
  ["min", variadic(Math.min)],
  ["pow", binary(Math.pow)],
  ["round", unary(Math.round)],
  ["sign", unary(Math.sign)],
  ["sin", unary(Math.sin)],
  ["sqrt", unary(Math.sqrt)],
  ["tan", unary(Math.tan)],
  ["trunc", unary(Math.trunc)],
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
  /(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z_][a-z0-9_]*)|(\*\*|[-+*/%^(),])/iy;

function describeArity({ minArgs, maxArgs }: ArithmeticFunction): string {
  const plural = (count: number) => `${count} ${count === 1 ? "argument" : "arguments"}`;

  if (minArgs === maxArgs) {
    return plural(minArgs);
  }

  return Number.isFinite(maxArgs)
    ? `${minArgs} to ${plural(maxArgs)}`
    : `at least ${plural(minArgs)}`;
}

function tokeniseArithmetic(expression: string): ArithmeticToken[] {
  const tokens: ArithmeticToken[] = [];
  let index = 0;

  while (index < expression.length) {
    if (/\s/.test(expression[index] ?? "")) {
      index += 1;
      continue;
    }

    TOKEN_PATTERN.lastIndex = index;
    const match = TOKEN_PATTERN.exec(expression);

    if (!match) {
      throw new ArithmeticExpressionError(
        `Unexpected character "${expression[index]}" at position ${index + 1}`,
      );
    }

    index = TOKEN_PATTERN.lastIndex;

    if (match[1] !== undefined) {
      const value = Number(match[1]);

      if (!Number.isFinite(value)) {
        throw new ArithmeticExpressionError(`Number "${match[1]}" is out of range`);
      }

      tokens.push({ kind: "number", value });
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
  let depth = 0;

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
    depth += 1;

    if (depth > MAX_ARITHMETIC_NESTING_DEPTH) {
      throw new ArithmeticExpressionError(
        `Expressions are limited to ${MAX_ARITHMETIC_NESTING_DEPTH} levels of nesting`,
      );
    }

    try {
      if (peekSymbol() === "-") {
        position += 1;

        return -parseUnary();
      }

      if (peekSymbol() === "+") {
        position += 1;

        return parseUnary();
      }

      return parsePower();
    } finally {
      depth -= 1;
    }
  };

  const parsePower = (): number => {
    const base = parsePrimary();

    if (peekSymbol() !== "^") {
      return base;
    }

    position += 1;

    return base ** parseUnary();
  };

  const parseCall = (name: string): number => {
    const fn = ARITHMETIC_FUNCTIONS.get(name);

    if (!fn) {
      throw new ArithmeticExpressionError(`Unknown function "${name}"`);
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

    if (args.length < fn.minArgs || args.length > fn.maxArgs) {
      throw new ArithmeticExpressionError(
        `"${name}" takes ${describeArity(fn)}, got ${args.length}`,
      );
    }

    return fn.apply(args);
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

    if (peekSymbol() === "(") {
      return parseCall(token.value);
    }

    const constant = ARITHMETIC_CONSTANTS.get(token.value);

    if (constant === undefined) {
      throw new ArithmeticExpressionError(`Unknown constant "${token.value}"`);
    }

    return constant;
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

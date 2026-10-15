/**
 * Tiny arithmetic evaluator for the price calculator.
 *
 * The backend stores the expression and result as free text, so the client
 * only ever needs to evaluate the user's own arithmetic. This is a hand-written
 * recursive-descent parser — deliberately no `eval` / `Function` anywhere.
 *
 * Supported: numbers, + - * / % ^, parentheses, unary minus and a small set of
 * functions (sqrt, abs, round, floor, ceil, min, max, pow, log, ln).
 */

type TokenType = "number" | "operator" | "paren" | "comma" | "identifier";

interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = new Set(["+", "-", "*", "/", "%", "^"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let number = "";
      let dots = 0;
      while (index < input.length && /[0-9.]/.test(input[index])) {
        if (input[index] === ".") dots += 1;
        number += input[index];
        index += 1;
      }
      if (dots > 1 || number === ".") throw new Error(`Invalid number “${number}”.`);
      tokens.push({ type: "number", value: number });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let name = "";
      while (index < input.length && /[a-zA-Z0-9_]/.test(input[index])) {
        name += input[index];
        index += 1;
      }
      tokens.push({ type: "identifier", value: name.toLowerCase() });
      continue;
    }

    if (OPERATORS.has(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      index += 1;
      continue;
    }

    if (char === "×") {
      tokens.push({ type: "operator", value: "*" });
      index += 1;
      continue;
    }
    if (char === "÷") {
      tokens.push({ type: "operator", value: "/" });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character “${char}”.`);
  }

  return tokens;
}

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  sqrt: (args) => Math.sqrt(args[0]),
  abs: (args) => Math.abs(args[0]),
  round: (args) => Math.round(args[0]),
  floor: (args) => Math.floor(args[0]),
  ceil: (args) => Math.ceil(args[0]),
  pow: (args) => Math.pow(args[0], args[1] ?? 2),
  log: (args) => Math.log10(args[0]),
  ln: (args) => Math.log(args[0]),
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
};

class Parser {
  private tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): number {
    if (!this.tokens.length) throw new Error("Enter an expression to evaluate.");
    const value = this.parseExpression();
    if (this.position < this.tokens.length) {
      throw new Error(`Unexpected “${this.tokens[this.position].value}”.`);
    }
    if (!Number.isFinite(value)) throw new Error("The result is not a finite number.");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private next(): Token | undefined {
    return this.tokens[this.position++];
  }

  private parseExpression(): number {
    return this.parseAdditive();
  }

  private parseAdditive(): number {
    let value = this.parseMultiplicative();
    let token = this.peek();
    while (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
      this.next();
      const right = this.parseMultiplicative();
      value = token.value === "+" ? value + right : value - right;
      token = this.peek();
    }
    return value;
  }

  private parseMultiplicative(): number {
    let value = this.parseExponent();
    let token = this.peek();
    while (
      token?.type === "operator" &&
      (token.value === "*" || token.value === "/" || token.value === "%")
    ) {
      this.next();
      const right = this.parseExponent();
      if (token.value === "*") value *= right;
      else if (token.value === "/") {
        if (right === 0) throw new Error("Cannot divide by zero.");
        value /= right;
      } else {
        if (right === 0) throw new Error("Cannot take a remainder by zero.");
        value %= right;
      }
      token = this.peek();
    }
    return value;
  }

  private parseExponent(): number {
    const base = this.parseUnary();
    const token = this.peek();
    if (token?.type === "operator" && token.value === "^") {
      this.next();
      const exponent = this.parseExponent();
      return Math.pow(base, exponent);
    }
    return base;
  }

  private parseUnary(): number {
    const token = this.peek();
    if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
      this.next();
      const value = this.parseUnary();
      return token.value === "-" ? -value : value;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.next();
    if (!token) throw new Error("The expression ends unexpectedly.");

    if (token.type === "number") return Number(token.value);

    if (token.type === "paren" && token.value === "(") {
      const value = this.parseExpression();
      const closing = this.next();
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        throw new Error("Missing a closing bracket.");
      }
      return value;
    }

    if (token.type === "identifier") {
      const fn = FUNCTIONS[token.value];
      if (!fn) throw new Error(`Unknown name “${token.value}”.`);
      const open = this.next();
      if (!open || open.type !== "paren" || open.value !== "(") {
        throw new Error(`“${token.value}” needs brackets, e.g. ${token.value}(9).`);
      }
      const args: number[] = [];
      if (this.peek()?.type === "paren" && this.peek()?.value === ")") {
        this.next();
      } else {
        args.push(this.parseExpression());
        while (this.peek()?.type === "comma") {
          this.next();
          args.push(this.parseExpression());
        }
        const close = this.next();
        if (!close || close.type !== "paren" || close.value !== ")") {
          throw new Error("Missing a closing bracket.");
        }
      }
      return fn(args);
    }

    throw new Error(`Unexpected “${token.value}”.`);
  }
}

export interface EvalResult {
  ok: boolean;
  value: number;
  error?: string;
}

/** Evaluates an arithmetic expression without using eval. */
export function evaluateExpression(input: string): EvalResult {
  try {
    const value = new Parser(tokenize(input)).parse();
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      value: 0,
      error: error instanceof Error ? error.message : "Could not evaluate the expression.",
    };
  }
}

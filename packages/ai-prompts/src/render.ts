import { PromptRenderError, PromptTemplateError } from "./errors.js";

export type PromptValue = string | number | boolean | null | undefined;
export type PromptValues = Readonly<Record<string, PromptValue>>;

type PromptNode =
  | { type: "text"; value: string }
  | { type: "variable"; name: string }
  | { type: "block"; name: string; inverted: boolean; children: PromptNode[] };

const TOKEN_PATTERN = /\{\{\s*([#^/]?)\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function parsePromptTemplate(text: string): PromptNode[] {
  const root: PromptNode[] = [];
  const stack: { name: string; children: PromptNode[] }[] = [];
  let current = root;
  let cursor = 0;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;

    if (index > cursor) {
      current.push({ type: "text", value: text.slice(cursor, index) });
    }

    cursor = index + match[0].length;
    const marker = match[1];
    const name = match[2];

    if (marker === "#" || marker === "^") {
      const children: PromptNode[] = [];

      current.push({ type: "block", name, inverted: marker === "^", children });
      stack.push({ name, children });
      current = children;
    } else if (marker === "/") {
      const open = stack.pop();

      if (!open || open.name !== name) {
        throw new PromptTemplateError(`Unexpected closing tag "{{/${name}}}"`);
      }

      current = stack.length > 0 ? stack[stack.length - 1].children : root;
    } else {
      current.push({ type: "variable", name });
    }
  }

  if (stack.length > 0) {
    throw new PromptTemplateError(`Unclosed block "{{#${stack[stack.length - 1].name}}}"`);
  }

  if (cursor < text.length) {
    current.push({ type: "text", value: text.slice(cursor) });
  }

  return root;
}

function isTruthy(value: PromptValue): boolean {
  return value !== undefined && value !== null && value !== "" && value !== false;
}

function resolveValue(
  name: string,
  values: PromptValues,
  defaults: PromptValues | undefined,
): PromptValue {
  const provided = values[name];

  if (provided !== undefined) {
    return provided;
  }

  return defaults?.[name];
}

function renderNodes(
  nodes: readonly PromptNode[],
  values: PromptValues,
  defaults: PromptValues | undefined,
): string {
  let output = "";

  for (const node of nodes) {
    if (node.type === "text") {
      output += node.value;
    } else if (node.type === "variable") {
      const value = resolveValue(node.name, values, defaults);

      if (value === undefined) {
        throw new PromptRenderError(`Missing value for "{{${node.name}}}"`);
      }

      output += String(value);
    } else {
      const value = resolveValue(node.name, values, defaults);

      if (isTruthy(value) !== node.inverted) {
        output += renderNodes(node.children, values, defaults);
      }
    }
  }

  return output;
}

export function renderPromptText(
  text: string,
  values: PromptValues = {},
  defaults?: PromptValues,
): string {
  return renderNodes(parsePromptTemplate(text), values, defaults);
}

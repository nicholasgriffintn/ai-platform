import type { SchemaJson, TypeOfAttribute } from "@cedar-policy/cedar-wasm/nodejs";

export type ContextShape = Record<string, TypeOfAttribute<string>>;

export const stringAttribute = { type: "String" } as const;
export const booleanAttribute = { type: "Boolean" } as const;
export const longAttribute = { type: "Long" } as const;
export const stringSetAttribute = { type: "Set", element: stringAttribute } as const;

type ContextAttribute =
  | typeof stringAttribute
  | typeof booleanAttribute
  | typeof longAttribute
  | typeof stringSetAttribute;

export type ContextFromShape<Shape extends Record<string, ContextAttribute>> = {
  [Key in keyof Shape]: Shape[Key]["type"] extends "String"
    ? string
    : Shape[Key]["type"] extends "Boolean"
      ? boolean
      : Shape[Key]["type"] extends "Long"
        ? number
        : string[];
};

export function actionSchema(actions: Record<string, ContextShape>): SchemaJson<string> {
  return {
    Polychat: {
      entityTypes: {
        Actor: { shape: { type: "Record", attributes: {} } },
        Resource: { shape: { type: "Record", attributes: {} } },
      },
      actions: Object.fromEntries(
        Object.entries(actions).map(([name, attributes]) => [
          name,
          {
            appliesTo: {
              principalTypes: ["Actor"],
              resourceTypes: ["Resource"],
              context: { type: "Record", attributes },
            },
          },
        ]),
      ),
    },
  };
}

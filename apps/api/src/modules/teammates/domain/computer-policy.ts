import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";

const COMMITTING_KEYS = new Set(["Return", "Tab", "ctrl+v"]);

export function computerInputRequiresTakeover(input: TeammateComputerInput): boolean {
  if (input.type === "type") {
    return true;
  }

  return input.type === "key" && COMMITTING_KEYS.has(input.key);
}

export function describeComputerTakeoverInput(input: TeammateComputerInput): string {
  switch (input.type) {
    case "click":
      return `Click at ${input.x}, ${input.y}`;
    case "type":
      return `Type "${input.text.length > 40 ? `${input.text.slice(0, 40)}…` : input.text}"`;
    case "key":
      return `Press ${input.key}`;
    default:
      return "This computer action";
  }
}

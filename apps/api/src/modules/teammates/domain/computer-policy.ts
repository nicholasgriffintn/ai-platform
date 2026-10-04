import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";

export function computerInputRequiresTakeover(input: TeammateComputerInput): boolean {
  return !authorise("computer.unattended", {
    inputType: input.type,
    key: input.type === "key" ? input.key : "",
  }).allowed;
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

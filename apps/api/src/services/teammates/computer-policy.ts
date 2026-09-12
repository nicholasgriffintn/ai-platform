import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";

export function computerInputRequiresTakeover(input: TeammateComputerInput): boolean {
  return input.type === "click" || input.type === "type" || input.type === "key";
}

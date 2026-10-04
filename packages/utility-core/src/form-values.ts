import { parseNumberInputValue } from "./numbers.js";

export function readFormFieldValues(
  form: HTMLFormElement,
  fields: readonly { name: string; type: string }[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields.flatMap<[string, unknown]>((field) => {
      const control = form.elements.namedItem(field.name);
      const raw =
        control instanceof HTMLInputElement ||
        control instanceof HTMLTextAreaElement ||
        control instanceof HTMLSelectElement
          ? control.value
          : "";

      if (field.type === "number") {
        const value = parseNumberInputValue(raw);

        return value === "" ? [] : [[field.name, value]];
      }

      return [
        [
          field.name,
          field.type === "checkbox" && control instanceof HTMLInputElement ? control.checked : raw,
        ],
      ];
    }),
  );
}

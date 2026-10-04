export function renderFormValuesModule(): string {
  return `export function readFormFieldValues(form: HTMLFormElement, fields: readonly { name: string; type: string }[]): Record<string, unknown> {
  return Object.fromEntries(fields.flatMap<[string, unknown]>((field) => {
    const control = form.elements.namedItem(field.name);
    if (field.type === "checkbox" && control instanceof HTMLInputElement) return [[field.name, control.checked]];
    if (field.type === "number" && control instanceof HTMLInputElement) {
      return control.value.trim() && Number.isFinite(control.valueAsNumber) ? [[field.name, control.valueAsNumber]] : [];
    }
    return [[field.name, control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement ? control.value : ""]];
  }));
}
`;
}

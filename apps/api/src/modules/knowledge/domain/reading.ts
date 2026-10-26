import type {
  ExtractionFields,
  ExtractionRequest,
  ReadingForm,
} from "@ngriffin_uk/polychat-schemas";

export const READING_STATE_CHARACTERS = 200_000;

export type ReadingMaterial = { image: string } | { text: string };

export function buildReadingRequest(
  form: ReadingForm,
  material: ReadingMaterial,
  referenceDate: string,
): ExtractionRequest {
  const fields: ExtractionFields = Object.fromEntries(
    form.fields.map(({ name, field }) => [name, field]),
  );

  return {
    ...("image" in material
      ? { images: [material.image] }
      : { state: material.text.slice(0, READING_STATE_CHARACTERS) }),
    fields,
    reference_date: referenceDate,
    options: { return_state_text: true },
  };
}

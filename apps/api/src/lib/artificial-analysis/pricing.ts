import { readNumberField } from "~/utils/recordFields";

export function deriveBlendedPrice(pricing: Record<string, unknown>): number | undefined {
	const explicit = readNumberField(pricing, "price_1m_blended_3_to_1");
	if (explicit !== undefined) {
		return explicit;
	}

	const inputPrice = readNumberField(pricing, "price_1m_input_tokens");
	const outputPrice = readNumberField(pricing, "price_1m_output_tokens");
	if (inputPrice === undefined || outputPrice === undefined) {
		return undefined;
	}

	return Number.parseFloat(((inputPrice * 3 + outputPrice) / 4).toFixed(10));
}

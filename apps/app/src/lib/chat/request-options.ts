import type { ChatRequestOptions } from "~/types";

export function mergeChatRequestOptions(
	base: ChatRequestOptions | undefined,
	override: ChatRequestOptions | undefined,
): ChatRequestOptions | undefined {
	if (!base && !override) {
		return undefined;
	}

	const hasNestedOptions = base?.options !== undefined || override?.options !== undefined;
	const hasMetadata = base?.metadata !== undefined || override?.metadata !== undefined;
	return {
		...base,
		...override,
		...(hasMetadata
			? {
					metadata: {
						...override?.metadata,
						...base?.metadata,
					},
				}
			: {}),
		...(hasNestedOptions
			? {
					options: {
						...base?.options,
						...override?.options,
					},
				}
			: {}),
	};
}

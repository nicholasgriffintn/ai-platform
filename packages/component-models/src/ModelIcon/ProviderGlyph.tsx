import { type ComponentProps, Suspense, lazy, useMemo } from "react";

import type { IconType } from "./icon-type";
import { ICON_LOADERS } from "./iconLoaders";

export interface ProviderGlyphProps extends ComponentProps<IconType> {
	/** Registry key for the brand glyph, for example "github" or "anthropic". */
	name: string;
}

/**
 * Renders a single brand glyph outside the model identity chrome. Individual icon modules stay
 * private to the package; this is the supported way to reach one.
 */
export function ProviderGlyph({ name, ...props }: ProviderGlyphProps) {
	const Icon = useMemo(() => {
		const loadIcon = ICON_LOADERS[name];
		return loadIcon ? lazy(loadIcon) : null;
	}, [name]);

	if (!Icon) return null;

	return (
		<Suspense fallback={null}>
			<Icon {...props} />
		</Suspense>
	);
}

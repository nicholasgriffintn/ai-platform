import { forwardRef } from "react";

import type { IconType } from "~/types";

export const TITLE = "ElevenLabs";

const Icon: IconType = forwardRef(({ size = "1em", style, ...rest }, ref) => {
	return (
		<svg
			ref={ref}
			fill="currentColor"
			fillRule="evenodd"
			height={size}
			style={{ flex: "none", lineHeight: 1, ...style }}
			viewBox="0 0 24 24"
			width={size}
			xmlns="http://www.w3.org/2000/svg"
			{...rest}
		>
			<title>{TITLE}</title>
			<path d="M5 0h5v24H5V0zM14 0h5v24h-5V0z" />
		</svg>
	);
});

export default Icon;

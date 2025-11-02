import { forwardRef } from "react";

import type { IconType } from "~/types";

export const TITLE = "Replicate";

const Icon: IconType = forwardRef(({ size = "1em", style, ...rest }, ref) => {
	const titleId = "replicate-icon-title";
	return (
		<svg
			fill="currentColor"
			fillRule="evenodd"
			height={size}
			ref={ref}
			style={{ flex: "none", lineHeight: 1, ...style }}
			viewBox="0 0 24 24"
			width={size}
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-labelledby={titleId}
			focusable="false"
			{...rest}
		>
			<title id={titleId}>{TITLE}</title>
			<path d="M22 10.552v2.26h-7.932V22H11.54V10.552H22zM22 2v2.264H4.528V22H2V2h20zm0 4.276V8.54H9.296V22H6.768V6.276H22z" />
		</svg>
	);
});

export default Icon;

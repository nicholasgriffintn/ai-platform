import { forwardRef } from "react";

import type { IconType } from "~/types";

export const TITLE = "together.ai";

const Icon: IconType = forwardRef(({ size = "1em", style, ...rest }, ref) => {
	const titleId = "together-ai-icon-title";
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
			<g>
				<path
					d="M17.385 11.23a4.615 4.615 0 100-9.23 4.615 4.615 0 000 9.23zm0 10.77a4.615 4.615 0 100-9.23 4.615 4.615 0 000 9.23zm-10.77 0a4.615 4.615 0 100-9.23 4.615 4.615 0 000 9.23z"
					opacity=".2"
				/>
				<circle cx="6.615" cy="6.615" fill="#0F6FFF" r="4.615" />
			</g>
		</svg>
	);
});

export default Icon;

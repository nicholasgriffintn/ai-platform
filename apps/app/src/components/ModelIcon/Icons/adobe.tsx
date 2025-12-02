import { forwardRef } from "react";

import type { IconType } from "~/types";

export const TITLE = "Adobe";

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
			<path d="M14.86 3H23v19zM9.14 3H1v19zM11.992 9.998L17.182 22h-3.394l-1.549-3.813h-3.79z" />
		</svg>
	);
});

export default Icon;

import { memo } from "react";

import type { IconType } from "~/types";

const TITLE = "OpenCode";

const Icon: IconType = memo(({ size = "1em", style, ...rest }) => {
	return (
		<svg
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
			<path d="M16 6H8v12h8V6zm4 16H4V2h16v20z" />
		</svg>
	);
});

export default Icon;

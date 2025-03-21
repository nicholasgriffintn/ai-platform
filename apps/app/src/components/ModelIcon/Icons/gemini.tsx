import { forwardRef } from "react";

import { useFillId } from "~/hooks/useFillId";
import type { IconType } from "~/types";

export const TITLE = "Gemini";

const Icon: IconType = forwardRef(({ size = "1em", style, ...rest }, ref) => {
	const titleId = "gemini-icon-title";
	const { id, fill } = useFillId(TITLE);
	return (
		<svg
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
			<defs>
				<linearGradient id={id} x1="0%" x2="68.73%" y1="100%" y2="30.395%">
					<stop offset="0%" stopColor="#1C7DFF" />
					<stop offset="52.021%" stopColor="#1C69FF" />
					<stop offset="100%" stopColor="#F0DCD6" />
				</linearGradient>
			</defs>
			<path
				d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12"
				fill={fill}
				fillRule="nonzero"
			/>
		</svg>
	);
});

export default Icon;

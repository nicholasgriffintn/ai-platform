import type { ImgHTMLAttributes } from "react";

import { cn } from "~/lib/utils";

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
	crossOrigin?: "anonymous" | "use-credentials";
}

export function Image({ className, crossOrigin = "anonymous", ...props }: ImageProps) {
	return (
		<img
			className={cn("max-w-full object-contain", className)}
			crossOrigin={crossOrigin}
			{...props}
		/>
	);
}

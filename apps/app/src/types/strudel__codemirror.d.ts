declare module "@strudel/codemirror" {
	import type { ComponentType } from "react";

	export interface StrudelMirrorProps {
		value?: string;
		onChange?: (value: string) => void;
		onEvaluate?: (value: string) => void;
		theme?: "dark" | "light";
		[key: string]: any;
	}

	export const StrudelMirror: ComponentType<StrudelMirrorProps>;
}

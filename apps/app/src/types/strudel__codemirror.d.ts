declare module "@strudel/codemirror" {
	export interface StrudelMirrorChange {
		docChanged: boolean;
		state: {
			doc: {
				toString(): string;
			};
		};
	}

	export interface StrudelMirrorOptions {
		root: HTMLElement;
		initialCode?: string;
		theme?: string;
		defaultOutput?: unknown;
		getTime?: () => number;
		transpiler?: unknown;
		drawTime?: [number, number];
		prebake?: () => Promise<void>;
		onChange?: (update: StrudelMirrorChange) => void;
	}

	export class StrudelMirror {
		code: string;

		constructor(options: StrudelMirrorOptions);

		evaluate(autostart?: boolean): Promise<void>;
		stop(): Promise<void>;
		setCode(code: string): void;
		setTheme(theme: string): void;
		clear(): void;
	}
}

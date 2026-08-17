import type { Pattern } from "@strudel/core";

type StrudelCoreModule = typeof import("@strudel/core");
type StrudelWebAudioModule = typeof import("@strudel/webaudio");
type StrudelCodeMirrorModule = typeof import("@strudel/codemirror");
type StrudelTranspilerModule = typeof import("@strudel/transpiler");

export interface StrudelRuntime {
	StrudelMirror: StrudelCodeMirrorModule["StrudelMirror"];
	getAudioContext: StrudelWebAudioModule["getAudioContext"];
	webaudioOutput: StrudelWebAudioModule["webaudioOutput"];
	transpiler: StrudelTranspilerModule["transpiler"];
	prebake: () => Promise<void>;
}

let runtimePromise: Promise<StrudelRuntime> | null = null;

export function sanitizeStrudelCode(code: string): string {
	return code
		.replace(/"([^"]*)"/g, (_, content: string) => {
			const sanitized = content.replace(/[^a-zA-Z0-9~*/!?[\]@<>(),:._^\-\s]/g, "");
			return `"${sanitized}"`;
		})
		.replace(/;+/g, "")
		.replace(/```[a-z]*|```/g, "")
		.trim();
}

export function loadStrudelRuntime(): Promise<StrudelRuntime> {
	runtimePromise ??= loadRuntimeModules();
	return runtimePromise;
}

async function loadRuntimeModules(): Promise<StrudelRuntime> {
	const [core, webaudio, codemirror, transpiler] = await Promise.all([
		import("@strudel/core"),
		import("@strudel/webaudio"),
		import("@strudel/codemirror"),
		import("@strudel/transpiler"),
	]);

	return {
		StrudelMirror: codemirror.StrudelMirror,
		getAudioContext: webaudio.getAudioContext,
		webaudioOutput: webaudio.webaudioOutput,
		transpiler: transpiler.transpiler,
		prebake: () => prebake(core, webaudio),
	};
}

async function prebake(core: StrudelCoreModule, webaudio: StrudelWebAudioModule) {
	const { evalScope, noteToMidi, valueToMidi, Pattern } = core;
	const { initAudioOnFirstClick, registerSynthSounds, samples, aliasBank, registerZZFXSounds } =
		webaudio;

	initAudioOnFirstClick();

	const modulesLoading = evalScope(
		import("@strudel/core"),
		import("@strudel/draw"),
		import("@strudel/mini"),
		import("@strudel/tonal"),
		import("@strudel/webaudio"),
		import("@strudel/codemirror"),
		import("@strudel/hydra"),
		import("@strudel/midi"),
	);

	const ds = "https://raw.githubusercontent.com/felixroos/dough-samples/main/";
	const ts = "https://raw.githubusercontent.com/todepond/samples/main/";
	await Promise.all([
		modulesLoading,
		registerSynthSounds(),
		registerZZFXSounds(),
		samples(`${ds}/tidal-drum-machines.json`),
		samples(`${ds}/piano.json`),
		samples(`${ds}/Dirt-Samples.json`),
		samples(`${ds}/EmuSP12.json`),
		samples(`${ds}/vcsl.json`),
		samples(`${ds}/mridangam.json`),
	]);
	aliasBank(`${ts}/tidal-drum-machines-alias.json`);

	const maxPan = noteToMidi("C8");
	const panwidth = (pan: number, width: number) => pan * width + (1 - width) / 2;

	type StrudelValue = Record<string, unknown>;

	type PianoPattern = Pattern & {
		fmap(mapper: (value: unknown) => StrudelValue): PianoPattern;
		s(sound: string): PianoPattern;
		release(value: number): PianoPattern;
	};

	Pattern.prototype.piano = function (this: PianoPattern) {
		return this.fmap((v: unknown) => {
			const vObj = v as StrudelValue;
			return {
				...vObj,
				clip: vObj.clip ?? 1,
			};
		})
			.s("piano")
			.release(0.1)
			.fmap((value: unknown) => {
				const midi = valueToMidi(value);
				const pan = panwidth(Math.min(Math.round(midi) / maxPan, 1), 0.5);
				const valueObj = value as StrudelValue;
				const panValue = typeof valueObj.pan === "number" ? valueObj.pan : 1;
				return {
					...valueObj,
					pan: panValue * pan,
				};
			});
	};
}

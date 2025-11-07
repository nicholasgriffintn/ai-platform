import {
	evalScope,
	noteToMidi,
	valueToMidi,
	Pattern,
	// @ts-expect-error - @strudel/core has no type definitions
} from "@strudel/core";
import {
	initAudioOnFirstClick,
	registerSynthSounds,
	samples,
	aliasBank,
	registerZZFXSounds,
	// @ts-expect-error - @strudel/webstudio has no type definitions
} from "@strudel/webaudio";

async function prebake() {
	initAudioOnFirstClick();

	const modulesLoading = evalScope(
		// @ts-expect-error - has no type definitions
		import("@strudel/core"),
		// @ts-expect-error - has no type definitions
		import("@strudel/draw"),
		// @ts-expect-error - has no type definitions
		import("@strudel/mini"),
		// @ts-expect-error - has no type definitions
		import("@strudel/tonal"),
		// @ts-expect-error - has no type definitions
		import("@strudel/webaudio"),
		import("@strudel/codemirror"),
		// @ts-expect-error - has no type definitions
		import("@strudel/hydra"),
		// @ts-expect-error - has no type definitions
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
	const panwidth = (pan: number, width: number) =>
		pan * width + (1 - width) / 2;

	type StrudelValue = Record<string, unknown>;

	Pattern.prototype.piano = function (this: any) {
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

export { prebake };

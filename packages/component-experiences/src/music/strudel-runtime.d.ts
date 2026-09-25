declare module "@strudel/core" {
  export type Pattern = unknown;
  export function evalScope(...modules: unknown[]): Promise<void>;
  export function silence(): Pattern;
  export const controls: Record<string, unknown>;
  export const noteToMidi: any;
  export const valueToMidi: any;
  export const Pattern: any;
  const strudelCore: Record<string, unknown>;

  export default strudelCore;
}

declare module "@strudel/webaudio" {
  export function getAudioContext(): AudioContext;
  export function initAudioOnFirstClick(): Promise<void>;
  export function registerSynthSounds(): Promise<void>;
  export function samples(url: string): Promise<void>;
  export function webaudioOutput(...args: unknown[]): unknown;
  export const aliasBank: any;
  export const registerZZFXSounds: any;
  const strudelWebaudio: Record<string, unknown>;

  export default strudelWebaudio;
}

declare module "@strudel/transpiler" {
  export function transpiler(code: string, options?: unknown): unknown;
  const strudelTranspiler: Record<string, unknown>;

  export default strudelTranspiler;
}

declare module "@strudel/mini" {
  const strudelMini: Record<string, unknown>;

  export default strudelMini;
}

declare module "@strudel/tonal" {
  const strudelTonal: Record<string, unknown>;

  export default strudelTonal;
}

declare module "@strudel/draw" {
  const strudelDraw: Record<string, unknown>;

  export default strudelDraw;
}

declare module "@strudel/hydra" {
  const strudelHydra: Record<string, unknown>;

  export default strudelHydra;
}

declare module "@strudel/midi" {
  const strudelMidi: Record<string, unknown>;

  export default strudelMidi;
}

declare module "@strudel/soundfonts" {
  export function registerSoundfonts(): Promise<void>;
  const strudelSoundfonts: Record<string, unknown>;

  export default strudelSoundfonts;
}

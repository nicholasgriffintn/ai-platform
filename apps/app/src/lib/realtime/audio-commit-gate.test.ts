import { describe, expect, it } from "vitest";

import {
	createAudioCommitGateState,
	observeAudioCommitGateSpeech,
	resetAudioCommitGate,
	shouldCommitAudioGate,
	type AudioCommitGateConfig,
} from "./audio-commit-gate";

const config: AudioCommitGateConfig = {
	continueLevelThreshold: 0.04,
	minSpeechMs: 200,
	silenceMs: 400,
	startLevelThreshold: 0.08,
};

describe("audio commit gate", () => {
	it("does not start a turn from low-level audio", () => {
		const state = createAudioCommitGateState();

		expect(observeAudioCommitGateSpeech(state, config, { level: 0.05, now: 1000 })).toBe(false);
		expect(shouldCommitAudioGate(state, config, 2000)).toBe(false);
	});

	it("commits after enough speech followed by enough silence", () => {
		const state = createAudioCommitGateState();

		expect(observeAudioCommitGateSpeech(state, config, { level: 0.09, now: 1000 })).toBe(true);
		expect(observeAudioCommitGateSpeech(state, config, { level: 0.05, now: 1250 })).toBe(true);

		expect(shouldCommitAudioGate(state, config, 1500)).toBe(false);
		expect(shouldCommitAudioGate(state, config, 1650)).toBe(true);
		expect(shouldCommitAudioGate(state, config, 2100)).toBe(false);
	});

	it("can be reset when the microphone stops", () => {
		const state = createAudioCommitGateState();

		observeAudioCommitGateSpeech(state, config, { level: 0.1, now: 1000 });
		resetAudioCommitGate(state);

		expect(shouldCommitAudioGate(state, config, 2000)).toBe(false);
	});
});

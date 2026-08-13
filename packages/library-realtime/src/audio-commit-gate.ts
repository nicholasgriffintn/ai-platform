export interface AudioCommitGateConfig {
	continueLevelThreshold: number;
	minSpeechMs: number;
	silenceMs: number;
	startLevelThreshold: number;
}

export interface AudioCommitGateState {
	lastSpeechAt: number;
	speechStartedAt: number;
	turnHasSpeech: boolean;
}

export function createAudioCommitGateState(): AudioCommitGateState {
	return {
		lastSpeechAt: 0,
		speechStartedAt: 0,
		turnHasSpeech: false,
	};
}

export function resetAudioCommitGate(state: AudioCommitGateState): void {
	state.lastSpeechAt = 0;
	state.speechStartedAt = 0;
	state.turnHasSpeech = false;
}

export function observeAudioCommitGateSpeech(
	state: AudioCommitGateState,
	config: AudioCommitGateConfig,
	{ level, now }: { level: number; now: number },
): boolean {
	const threshold = state.turnHasSpeech
		? config.continueLevelThreshold
		: config.startLevelThreshold;
	if (level < threshold) {
		return false;
	}

	if (!state.turnHasSpeech) {
		state.speechStartedAt = now;
	}

	state.lastSpeechAt = now;
	state.turnHasSpeech = true;
	return true;
}

export function shouldCommitAudioGate(
	state: AudioCommitGateState,
	config: AudioCommitGateConfig,
	now: number,
): boolean {
	if (!state.turnHasSpeech) {
		return false;
	}

	const hasEnoughSilence = now - state.lastSpeechAt >= config.silenceMs;
	const hasEnoughSpeech = state.lastSpeechAt - state.speechStartedAt >= config.minSpeechMs;
	if (!hasEnoughSilence || !hasEnoughSpeech) {
		return false;
	}

	resetAudioCommitGate(state);
	return true;
}

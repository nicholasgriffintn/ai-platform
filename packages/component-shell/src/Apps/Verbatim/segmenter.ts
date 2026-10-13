import {
  createAudioCommitGateState,
  observeAudioCommitGateSpeech,
  resetAudioCommitGate,
  shouldCommitAudioGate,
  type AudioCommitGateConfig,
} from "@ngriffin_uk/polychat-library-realtime/audio-commit-gate";
import { calculatePcm16AudioLevel } from "@ngriffin_uk/polychat-library-realtime/audio-levels";

export const SEGMENT_SAMPLE_RATE = 16000;

const GATE: AudioCommitGateConfig = {
  startLevelThreshold: 0.05,
  continueLevelThreshold: 0.03,
  minSpeechMs: 250,
  silenceMs: 450,
};
const MAX_SEGMENT_MS = 10_000;
const PRE_ROLL_MS = 400;

function chunkMs(chunk: ArrayBuffer): number {
  return (chunk.byteLength / 2 / SEGMENT_SAMPLE_RATE) * 1000;
}

export interface SpeechSegmenterStep {
  level: number;
  segment: ArrayBuffer[] | null;
}

export class SpeechSegmenter {
  private readonly gate = createAudioCommitGateState();
  private chunks: ArrayBuffer[] = [];
  private bufferedMs = 0;
  private heardSpeech = false;

  push(chunk: ArrayBuffer, now: number): SpeechSegmenterStep {
    const level = calculatePcm16AudioLevel(chunk);

    this.chunks.push(chunk);
    this.bufferedMs += chunkMs(chunk);

    if (observeAudioCommitGateSpeech(this.gate, GATE, { level, now })) {
      this.heardSpeech = true;
    }

    if (!this.heardSpeech) {
      this.trimToPreRoll();

      return { level, segment: null };
    }

    if (shouldCommitAudioGate(this.gate, GATE, now) || this.bufferedMs >= MAX_SEGMENT_MS) {
      return { level, segment: this.take() };
    }

    return { level, segment: null };
  }

  peek(): ArrayBuffer[] | null {
    return this.heardSpeech ? [...this.chunks] : null;
  }

  flush(): ArrayBuffer[] | null {
    return this.heardSpeech ? this.take() : null;
  }

  private take(): ArrayBuffer[] {
    const segment = this.chunks;

    this.chunks = [];
    this.bufferedMs = 0;
    this.heardSpeech = false;
    resetAudioCommitGate(this.gate);

    return segment;
  }

  private trimToPreRoll(): void {
    while (this.chunks.length > 1 && this.bufferedMs - chunkMs(this.chunks[0]) >= PRE_ROLL_MS) {
      this.bufferedMs -= chunkMs(this.chunks.shift() ?? new ArrayBuffer(0));
    }
  }
}

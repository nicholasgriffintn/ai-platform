import { useEffect, useRef } from "react";

const CROSSFADE_SECONDS = 8;
const FADE_SECONDS = 2;
const LEVEL_SECONDS = 0.3;
const SCHEDULE_AHEAD_SECONDS = 2;
const SCHEDULE_TICK_MS = 500;

interface LoopEngine {
  context: AudioContext;
  master: GainNode;
  buffer: AudioBuffer;
  nextStart: number | null;
  playing: boolean;
  suspendTimer: number | null;
}

async function loadLoopBuffer(
  context: AudioContext,
  src: string,
  signal: AbortSignal,
): Promise<AudioBuffer> {
  const response = await fetch(src, { credentials: "include", signal });

  if (!response.ok) {
    throw new Error(`The sound could not be loaded (${response.status})`);
  }

  return context.decodeAudioData(await response.arrayBuffer());
}

function scheduleLayer(engine: LoopEngine, startAt: number): void {
  const { context, buffer, master } = engine;
  const crossfade = Math.min(CROSSFADE_SECONDS, buffer.duration / 3);
  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = buffer;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(1, startAt + crossfade);
  gain.gain.setValueAtTime(1, startAt + buffer.duration - crossfade);
  gain.gain.linearRampToValueAtTime(0, startAt + buffer.duration);
  source.connect(gain).connect(master);
  source.addEventListener("ended", () => gain.disconnect());
  source.start(startAt);
  engine.nextStart = startAt + buffer.duration - crossfade;
}

function applyLoopState(engine: LoopEngine, playing: boolean, volume: number): void {
  const { context, master } = engine;
  const now = context.currentTime;
  const ramp = playing === engine.playing ? LEVEL_SECONDS : FADE_SECONDS;

  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);

  if (engine.suspendTimer !== null) {
    window.clearTimeout(engine.suspendTimer);
    engine.suspendTimer = null;
  }

  if (playing) {
    void context.resume();

    if (engine.nextStart === null) {
      scheduleLayer(engine, now);
    }

    master.gain.linearRampToValueAtTime(volume, now + ramp);
  } else {
    master.gain.linearRampToValueAtTime(0, now + ramp);
    engine.suspendTimer = window.setTimeout(() => void context.suspend(), ramp * 1000);
  }

  engine.playing = playing;
}

export function useCrossfadeLoop(
  src: string | null,
  playing: boolean,
  volume: number,
  onError?: () => void,
): void {
  const engineRef = useRef<LoopEngine | null>(null);
  const stateRef = useRef({ playing, volume });
  const errorRef = useRef(onError);

  useEffect(() => {
    errorRef.current = onError;
  });

  useEffect(() => {
    if (!src || typeof AudioContext === "undefined") {
      return undefined;
    }

    const context = new AudioContext();
    const master = context.createGain();
    const controller = new AbortController();
    let ticker: number | null = null;

    master.gain.value = 0;
    master.connect(context.destination);
    void context.suspend();

    loadLoopBuffer(context, src, controller.signal)
      .then((buffer) => {
        const engine: LoopEngine = {
          context,
          master,
          buffer,
          nextStart: null,
          playing: false,
          suspendTimer: null,
        };

        engineRef.current = engine;
        ticker = window.setInterval(() => {
          if (
            context.state === "running" &&
            engine.nextStart !== null &&
            context.currentTime > engine.nextStart - SCHEDULE_AHEAD_SECONDS
          ) {
            scheduleLayer(engine, Math.max(engine.nextStart, context.currentTime));
          }
        }, SCHEDULE_TICK_MS);
        applyLoopState(engine, stateRef.current.playing, stateRef.current.volume);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          errorRef.current?.();
        }
      });

    return () => {
      controller.abort();

      if (ticker !== null) {
        window.clearInterval(ticker);
      }

      if (engineRef.current?.suspendTimer) {
        window.clearTimeout(engineRef.current.suspendTimer);
      }

      engineRef.current = null;
      void context.close();
    };
  }, [src]);

  useEffect(() => {
    stateRef.current = { playing, volume };

    if (engineRef.current) {
      applyLoopState(engineRef.current, playing, volume);
    }
  }, [playing, volume]);
}

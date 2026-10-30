import { useCallback, useEffect, useRef } from "react";

/**
 * Spoken recordings arrive at whatever level the voice provider chose, which is
 * quiet next to most media, and a long read can drift quieter still. Routing the
 * element through a compressor evens the level out and lifts it to a steady
 * listening volume without clipping the loud moments.
 */
const VOICE_THRESHOLD_DB = -28;
const VOICE_KNEE_DB = 12;
const VOICE_RATIO = 4;
const VOICE_ATTACK_SECONDS = 0.003;
const VOICE_RELEASE_SECONDS = 0.25;
const VOICE_LIFT = 1.4;

interface LoudnessStage {
  source: MediaElementAudioSourceNode;
  compressor: DynamicsCompressorNode;
  lift: GainNode;
}

let sharedContext: AudioContext | null = null;
const stages = new WeakMap<HTMLMediaElement, LoudnessStage>();

function audioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") {
    return null;
  }

  sharedContext ??= new AudioContext();

  return sharedContext;
}

function stageFor(element: HTMLMediaElement): LoudnessStage | null {
  const existing = stages.get(element);

  if (existing) {
    return existing;
  }

  const context = audioContext();

  if (!context) {
    return null;
  }

  try {
    const source = context.createMediaElementSource(element);
    const compressor = context.createDynamicsCompressor();
    const lift = context.createGain();

    compressor.threshold.value = VOICE_THRESHOLD_DB;
    compressor.knee.value = VOICE_KNEE_DB;
    compressor.ratio.value = VOICE_RATIO;
    compressor.attack.value = VOICE_ATTACK_SECONDS;
    compressor.release.value = VOICE_RELEASE_SECONDS;
    lift.gain.value = VOICE_LIFT;
    source.connect(compressor).connect(lift).connect(context.destination);

    const stage = { source, compressor, lift };
    const wake = () => void context.resume();

    stages.set(element, stage);
    element.addEventListener("play", wake);
    element.addEventListener("playing", wake);

    return stage;
  } catch {
    return null;
  }
}

/**
 * Levels and lifts a spoken media element. Wraps a media track's `attach` so the
 * element keeps its ordinary events; `element.volume` still applies first.
 *
 * Only use it for media served with CORS headers that match the element's
 * `crossOrigin`: a tainted element goes silent once it is routed through audio.
 */
export function useMediaLoudness(
  attach: (element: HTMLMediaElement | null) => void,
  enabled = true,
): (element: HTMLMediaElement | null) => void {
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  });

  return useCallback(
    (element: HTMLMediaElement | null) => {
      attach(element);

      if (element && enabledRef.current) {
        stageFor(element);
      }
    },
    [attach],
  );
}

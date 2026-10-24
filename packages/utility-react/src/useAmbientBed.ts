import { useEffect, useRef } from "react";

const BED_SECONDS = 4;
const BED_LEVEL = 0.18;
const FADE_SECONDS = 1.5;
const SWELL_HZ = 0.08;

interface AmbientBed {
  context: AudioContext;
  output: GainNode;
}

function brownNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * BED_SECONDS, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let last = 0;

  for (let index = 0; index < samples.length; index += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    samples[index] = last * 3.5;
  }

  return buffer;
}

function createAmbientBed(): AmbientBed {
  const context = new AudioContext();
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const swell = context.createGain();
  const lfo = context.createOscillator();
  const lfoDepth = context.createGain();
  const output = context.createGain();

  source.buffer = brownNoiseBuffer(context);
  source.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 520;
  lfo.frequency.value = SWELL_HZ;
  lfoDepth.gain.value = 0.35;
  swell.gain.value = 0.65;
  output.gain.value = 0;

  lfo.connect(lfoDepth).connect(swell.gain);
  source.connect(filter).connect(swell).connect(output).connect(context.destination);
  source.start();
  lfo.start();

  return { context, output };
}

export function useAmbientBed(active: boolean): void {
  const bedRef = useRef<AmbientBed | null>(null);

  useEffect(() => {
    if (!active && !bedRef.current) {
      return;
    }

    if (typeof AudioContext === "undefined") {
      return;
    }

    bedRef.current ??= createAmbientBed();

    const { context, output } = bedRef.current;
    const now = context.currentTime;

    if (active) {
      void context.resume();
    }

    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(output.gain.value, now);
    output.gain.linearRampToValueAtTime(active ? BED_LEVEL : 0, now + FADE_SECONDS);
  }, [active]);

  useEffect(
    () => () => {
      void bedRef.current?.context.close();
      bedRef.current = null;
    },
    [],
  );
}

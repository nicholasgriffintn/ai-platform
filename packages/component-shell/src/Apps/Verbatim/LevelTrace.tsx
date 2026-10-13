import { useEffect, useRef } from "react";

const SAMPLES = 160;

export function LevelTrace({
  level,
  active,
  markers,
}: {
  level: number;
  active: boolean;
  markers: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(Array<number>(SAMPLES).fill(0));
  const ticksRef = useRef<number[]>([]);
  const markersRef = useRef(markers);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const history = historyRef.current;

    history.push(active ? level : 0);
    history.shift();
    ticksRef.current = ticksRef.current.map((tick) => tick - 1).filter((tick) => tick >= 0);

    if (markers > markersRef.current) {
      ticksRef.current.push(SAMPLES - 1);
    }

    markersRef.current = markers;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    const style = getComputedStyle(canvas);
    const step = width / SAMPLES;
    const middle = height / 2;

    context.fillStyle = style.color;
    history.forEach((value, index) => {
      const amplitude = Math.max(1, Math.min(1, value * 2.4) * (middle - 2));

      context.globalAlpha = 0.25 + (index / SAMPLES) * 0.75;
      context.fillRect(index * step, middle - amplitude, Math.max(1, step - 1.5), amplitude * 2);
    });

    context.globalAlpha = 0.9;
    context.fillStyle = style.borderColor;
    ticksRef.current.forEach((tick) => {
      context.fillRect(tick * step, 0, 1.5, height);
    });
  }, [active, level, markers]);

  return (
    <canvas
      ref={canvasRef}
      className="h-16 w-full border-accent-emerald text-accent-emerald"
      aria-hidden
    />
  );
}

import { type RefObject, useEffect, useRef } from "react";

interface CanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isFillMode: boolean;
  currentColor: string;
  lineWidth: number;
  saveToHistory: () => void;
  onDrawingComplete: () => void;
  isReadOnly?: boolean;
  drawingData?: string;
}

export function Canvas({
  canvasRef,
  isFillMode,
  currentColor,
  lineWidth,
  saveToHistory,
  onDrawingComplete,
  isReadOnly = false,
  drawingData,
}: CanvasProps) {
  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    console.log("drawingData", drawingData);
    if (!drawingData || !canvasRef?.current) return;

    const image = new Image();
    image.onload = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(image, 0, 0);
    };
    image.src = drawingData;
  }, [drawingData]);

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current || !canvasRef?.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x =
      (("touches" in e && e.touches[0]
        ? e.touches[0].clientX
        : "clientX" in e
          ? e.clientX
          : 0) -
        rect.left) *
      scaleX;
    const y =
      (("touches" in e && e.touches[0]
        ? e.touches[0].clientY
        : "clientY" in e
          ? e.clientY
          : 0) -
        rect.top) *
      scaleY;

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    lastX.current = x;
    lastY.current = y;
  };

  const fill = () => {
    if (!canvasRef?.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = currentColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    saveToHistory();
    onDrawingComplete();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isReadOnly) return;

    const canvas = canvasRef?.current;
    if (!canvas) return;

    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e && e.touches[0]) {
      lastX.current = (e.touches[0].clientX - rect.left) * scaleX;
      lastY.current = (e.touches[0].clientY - rect.top) * scaleY;
    } else if ("clientX" in e && "clientY" in e) {
      lastX.current = (e.clientX - rect.left) * scaleX;
      lastY.current = (e.clientY - rect.top) * scaleY;
    }

    if (isFillMode) {
      fill();
      isDrawing.current = false;
    }
  };

  const stopDrawing = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      saveToHistory();
      onDrawingComplete();
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;

    if (!isReadOnly) {
      const handleMouseMove = (e: MouseEvent) => draw(e);
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        draw(e);
      };

      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("touchmove", handleTouchMove);

      return () => {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("touchmove", handleTouchMove);
      };
    }
  }, [isReadOnly, currentColor, lineWidth, isFillMode]);

  return (
    <>
      <span className="sr-only">
        Drawing Canvas {isReadOnly ? "ReadOnly" : "Editable"}
      </span>
      <canvas
        ref={canvasRef}
        width={800}
        height={650}
        className={`bg-[#f9fafb] w-full h-auto max-h-[80vh] border border-gray-200 rounded-lg touch-none ${
          isReadOnly ? "cursor-default" : "cursor-crosshair"
        }`}
        style={{ aspectRatio: "800 / 650" }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onBlur={stopDrawing}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
      />
    </>
  );
}

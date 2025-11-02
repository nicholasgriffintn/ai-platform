import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { Canvas } from "~/components/Apps/Drawings/Canvas";
import { ColorPicker } from "~/components/Apps/Drawings/ColorPicker";
import { LineWidthPicker } from "~/components/Apps/Drawings/LineWidthPicker";
import { ToolPicker } from "~/components/Apps/Drawings/ToolPicker";
import { LINE_WIDTHS } from "~/components/Apps/Drawings/constants";
import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button, Card } from "~/components/ui";
import { useGenerateDrawing, useGuessDrawing } from "~/hooks/useDrawings";

export function meta() {
  return [
    { title: "New Drawing - Polychat" },
    { name: "description", content: "Create a new drawing and transform it" },
  ];
}

export default function NewDrawingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentColor, setCurrentColor] = useState("#030712");
  const [lineWidth, setLineWidth] = useState(LINE_WIDTHS[2]);
  const [isFillMode, setIsFillMode] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [guessResult, setGuessResult] = useState<string | null>(null);
  const [guessedDrawingId, setGuessedDrawingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawingHistory, setDrawingHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  const generateMutation = useGenerateDrawing();
  const guessMutation = useGuessDrawing();

  const saveToHistory = useCallback(() => {
    if (!canvasRef.current) return;

    const dataUrl = canvasRef.current.toDataURL("image/png");
    setPreview(dataUrl);

    const newHistory = drawingHistory.slice(0, currentHistoryIndex + 1);
    newHistory.push(dataUrl);
    setDrawingHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  }, [drawingHistory, currentHistoryIndex]);

  const handleDrawingComplete = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    setPreview(dataUrl);
  }, []);

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  }, [saveToHistory]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only need to run once
  useCallback(() => {
    initializeCanvas();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
    setGuessResult(null);
  }, [saveToHistory]);

  const undoDrawing = useCallback(() => {
    if (currentHistoryIndex <= 0) return;

    const newIndex = currentHistoryIndex - 1;
    setCurrentHistoryIndex(newIndex);

    const previousDrawing = drawingHistory[newIndex];
    if (previousDrawing && canvasRef.current) {
      const image = new Image();
      image.onload = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(image, 0, 0);
        setPreview(previousDrawing);
      };
      image.src = previousDrawing;
    }
  }, [currentHistoryIndex, drawingHistory]);

  const redoDrawing = useCallback(() => {
    if (currentHistoryIndex >= drawingHistory.length - 1) return;

    const newIndex = currentHistoryIndex + 1;
    setCurrentHistoryIndex(newIndex);

    const nextDrawing = drawingHistory[newIndex];
    if (nextDrawing && canvasRef.current) {
      const image = new Image();
      image.onload = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(image, 0, 0);
        setPreview(nextDrawing);
      };
      image.src = nextDrawing;
    }
  }, [currentHistoryIndex, drawingHistory]);

  const handleGuess = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsProcessing(true);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else throw new Error("Could not convert canvas to blob");
        }, "image/png");
      });

      const file = new File([blob], "drawing.png", { type: "image/png" });

      const result = await guessMutation.mutateAsync({ drawing: file });
      const content = result.content;
      setGuessResult(content);

      if (result.completion_id) {
        setGuessedDrawingId(result.completion_id);
        console.log("Drawing ID from guess:", result.completion_id);
      }
    } catch (error) {
      console.error("Error guessing drawing:", error);
      setGuessResult("Error: Could not process your drawing");
    } finally {
      setIsProcessing(false);
    }
  }, [guessMutation]);

  const handleGenerate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsProcessing(true);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else throw new Error("Could not convert canvas to blob");
        }, "image/png");
      });

      const file = new File([blob], "drawing.png", { type: "image/png" });

      const payload = guessedDrawingId
        ? { drawing: file, drawingId: guessedDrawingId }
        : { drawing: file };

      const result = await generateMutation.mutateAsync(payload);

      if (result?.app_data_id) {
        navigate(`/apps/drawing/${result.app_data_id}`);
      } else {
        setGuessResult("Error: Could not navigate to your drawing");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      setGuessResult("Error: Could not generate image from your drawing");
    } finally {
      setIsProcessing(false);
    }
  }, [generateMutation, navigate, guessedDrawingId]);

  return (
    <PageShell
      sidebarContent={<AppsSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <PageHeader>
          <BackLink to="/apps/drawing" label="Back to Drawings" />
          <h1 className="text-2xl font-bold">Create New Drawing</h1>
        </PageHeader>
      }
      isBeta={true}
    >
      <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        <p>Draw any shape, object, or scene in the canvas below.</p>
        <p>
          Click "Transform Drawing" to see your creation transformed into art.
        </p>
        <p>
          Alternatively, click "Guess What I Drew" to have the AI try to
          identify your drawing.
        </p>
      </div>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="w-full sm:w-1/3 flex flex-col space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Tools</h3>
                  <ToolPicker
                    isFillMode={isFillMode}
                    setIsFillMode={setIsFillMode}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Colors</h3>
                  <ColorPicker
                    currentColor={currentColor}
                    setCurrentColor={setCurrentColor}
                  />
                </div>

                <div className="space-y-4">
                  <LineWidthPicker
                    lineWidth={lineWidth}
                    setLineWidth={setLineWidth}
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={undoDrawing}
                      disabled={isProcessing || currentHistoryIndex <= 0}
                      title="Undo"
                    >
                      Undo
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={redoDrawing}
                      disabled={
                        isProcessing ||
                        currentHistoryIndex >= drawingHistory.length - 1
                      }
                      title="Redo"
                    >
                      Redo
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={clearCanvas}
                    disabled={isProcessing}
                    className="w-full"
                    title="Clear Canvas"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="w-full sm:w-2/3 relative">
                <Canvas
                  canvasRef={canvasRef}
                  isFillMode={isFillMode}
                  currentColor={currentColor}
                  lineWidth={lineWidth}
                  saveToHistory={saveToHistory}
                  onDrawingComplete={handleDrawingComplete}
                  drawingData={
                    currentHistoryIndex >= 0
                      ? drawingHistory[currentHistoryIndex]
                      : undefined
                  }
                />

                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto" />
                      <p className="mt-2">Processing...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                {guessResult && (
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md">
                    <p className="font-medium mb-1">AI Guess:</p>
                    <p>{guessResult}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGuess}
                  variant="outline"
                  disabled={isProcessing || !preview}
                >
                  Guess What I Drew
                </Button>
                <Button
                  onClick={handleGenerate}
                  variant="primary"
                  disabled={isProcessing || !preview}
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full mr-2" />
                      Processing...
                    </>
                  ) : (
                    "Transform Drawing"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

export async function canvasToPngFile(canvas: HTMLCanvasElement): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);

        return;
      }

      reject(new Error("Could not convert canvas to blob"));
    }, "image/png");
  });

  return new File([blob], "drawing.png", { type: "image/png" });
}

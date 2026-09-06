import { LINE_WIDTHS } from "./constants";

interface LineWidthPickerProps {
  lineWidth: number;
  setLineWidth: (width: number) => void;
}

export function LineWidthPicker({ lineWidth, setLineWidth }: LineWidthPickerProps) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="line-width" className="text-sm font-medium">
            Line Width
          </label>
          <span className="text-sm text-muted-foreground">{lineWidth}px</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {LINE_WIDTHS.map((width) => (
            <button
              type="button"
              key={width}
              onClick={() => setLineWidth(width)}
              className={`flex h-12 items-center justify-center rounded-md p-2 transition-all duration-200 ${
                lineWidth === width
                  ? "outline-[2px solid #3b82f6] scale-105 border-2 border-primary bg-primary/10 shadow-sm outline"
                  : "border border-muted hover:border-primary/50 hover:bg-muted"
              } `}
              title={`${width}px`}
            >
              <div className="flex w-full items-center justify-center">
                <div
                  className="rounded-full bg-foreground"
                  style={{
                    width: `${width}px`,
                    height: `${width}px`,
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-background p-3">
        <div className="h-[2px] w-full bg-muted" />
        <div
          className="w-full rounded-full bg-foreground transition-all duration-200"
          style={{
            height: `${lineWidth}px`,
            marginTop: "8px",
          }}
        />
      </div>
    </>
  );
}

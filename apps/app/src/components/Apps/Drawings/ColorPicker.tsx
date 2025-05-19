import { COLORS } from "./constants";

interface ColorPickerProps {
  currentColor: string;
  setCurrentColor: (color: string) => void;
}

export function ColorPicker({
  currentColor,
  setCurrentColor,
}: ColorPickerProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={currentColor}
          onChange={(e) => setCurrentColor(e.target.value)}
          className="w-10 h-10 rounded-md cursor-pointer border-0"
          title="Custom Color"
        />
        <span className="text-sm text-muted-foreground">Custom Color</span>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setCurrentColor(color)}
            className="aspect-square rounded-md transition-all hover:scale-110 hover:shadow-lg"
            style={{
              backgroundColor: color,
              outline: color === currentColor ? "2px solid #3b82f6" : "none",
              outlineOffset: "2px",
              transform: color === currentColor ? "scale(1.1)" : "scale(1)",
            }}
            aria-label={`Select ${color} color`}
          />
        ))}
      </div>
    </>
  );
}

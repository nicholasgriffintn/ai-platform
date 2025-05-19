import { Button } from "~/components/ui/Button";

interface ToolPickerProps {
  isFillMode: boolean;
  setIsFillMode: (isFillMode: boolean) => void;
}

export function ToolPicker({ isFillMode, setIsFillMode }: ToolPickerProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={!isFillMode ? "secondary" : "outline"}
        size="sm"
        onClick={() => setIsFillMode(false)}
        className="flex-1"
      >
        Brush
      </Button>
      <Button
        variant={isFillMode ? "secondary" : "outline"}
        size="sm"
        onClick={() => setIsFillMode(true)}
        className="flex-1"
      >
        Fill
      </Button>
    </div>
  );
}

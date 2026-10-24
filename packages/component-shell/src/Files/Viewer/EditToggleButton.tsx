import { Button } from "@ngriffin_uk/polychat-component-ui";
import { Eye, Pencil } from "lucide-react";

export function EditToggleButton({
  isEditing,
  onToggle,
}: {
  isEditing: boolean;
  onToggle: () => void;
}) {
  const label = isEditing ? "Stop editing" : "Edit";

  return (
    <Button
      variant="icon"
      size="sm"
      icon={isEditing ? <Eye size={15} /> : <Pencil size={15} />}
      aria-label={label}
      aria-pressed={isEditing}
      title={label}
      onClick={onToggle}
    />
  );
}

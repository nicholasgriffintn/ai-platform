import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverSettings } from "@ngriffin_uk/polychat-schemas";

export interface DiscoverNewsFieldProps {
  categories: DiscoverSettings["newsCategories"];
  isSaving: boolean;
  onChange: (categoryIds: string[]) => void;
}

export function DiscoverNewsField({ categories, isSaving, onChange }: DiscoverNewsFieldProps) {
  const selected = categories.filter((category) => category.selected);

  const toggle = (id: string) =>
    onChange(
      categories
        .filter((category) => (category.id === id ? !category.selected : category.selected))
        .map((category) => category.id),
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">News</p>
        <p className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "Pick what news you want. Headlines and your topics come from these outlets instead of a general web search."
            : `Headlines come from ${selected.map((category) => category.label).join(", ")}. Your topics use these outlets first and search the web only when they have little on it.`}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <li key={category.id}>
            <Button
              type="button"
              size="sm"
              variant={category.selected ? "primary" : "outline"}
              aria-pressed={category.selected}
              title={category.sources.join(", ")}
              disabled={isSaving}
              onClick={() => toggle(category.id)}
            >
              {category.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

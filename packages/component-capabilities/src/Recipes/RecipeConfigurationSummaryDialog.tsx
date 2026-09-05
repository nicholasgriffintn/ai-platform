import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { formatRecipeConfigurationSummaryValue } from "@ngriffin_uk/polychat-schemas";
import type { AssistantRecipe, RecipeInstallation } from "@ngriffin_uk/polychat-schemas";

interface RecipeConfigurationSummaryDialogProps {
  recipe: AssistantRecipe | null;
  installation: RecipeInstallation | null;
  onOpenChange: (open: boolean) => void;
}

export function RecipeConfigurationSummaryDialog({
  recipe,
  installation,
  onOpenChange,
}: RecipeConfigurationSummaryDialogProps) {
  const configuration = installation?.configuration ?? {};
  const fieldByKey = new Map(recipe?.configurationFields.map((field) => [field.key, field]));
  const orderedKeys = [
    ...(recipe?.configurationFields ?? [])
      .map((field) => field.key)
      .filter((key) => Object.hasOwn(configuration, key)),
    ...Object.keys(configuration).filter((key) => !fieldByKey.has(key)),
  ];

  return (
    <Dialog open={recipe !== null && installation !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {recipe ? `${recipe.title} configuration` : "Recipe configuration"}
          </DialogTitle>
          <DialogDescription>
            Saved values used whenever this project recipe runs.
          </DialogDescription>
        </DialogHeader>

        {orderedKeys.length ? (
          <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {orderedKeys.map((key) => (
              <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                <dt className="text-xs font-medium text-muted-foreground">
                  {fieldByKey.get(key)?.label ?? key}
                </dt>
                <dd className="break-words text-sm text-foreground">
                  {formatRecipeConfigurationSummaryValue(configuration[key])}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            This recipe has no saved configuration.
          </p>
        )}

        <DialogFooter>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

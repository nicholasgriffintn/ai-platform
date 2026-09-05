import { Checkbox, FormDialog, Input, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  type ConfigurationFormValues,
  formatRecipeConfigurationValue,
  isRequiredRecipeConfigurationMissing,
  type AssistantRecipe,
  type RecipeConfigurationField,
  type RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";

interface RecipeConfigurationDialogProps {
  recipe: AssistantRecipe | null;
  installation: RecipeInstallation | null;
  values: ConfigurationFormValues;
  onValuesChange: (values: ConfigurationFormValues) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  isLoading: boolean;
  submitText?: string;
}

function RecipeConfigurationFieldInput({
  field,
  value,
  onChange,
}: {
  field: RecipeConfigurationField;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border p-3">
        <Checkbox
          id={`recipe-configuration-${field.key}`}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <div className="space-y-1">
          <Label htmlFor={`recipe-configuration-${field.key}`}>{field.label}</Label>
          {field.description && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
        </div>
      </div>
    );
  }

  const inputValue = typeof value === "string" ? value : "";

  return (
    <div className="space-y-2">
      <Label htmlFor={`recipe-configuration-${field.key}`}>
        {field.label}
        {field.required && <span className="text-failure"> *</span>}
      </Label>
      {field.type === "textarea" || field.type === "string_list" ? (
        <Textarea
          id={`recipe-configuration-${field.key}`}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          rows={field.type === "string_list" ? 3 : 5}
          placeholder={
            field.placeholder ??
            (field.type === "string_list" ? "One item per line or comma separated" : undefined)
          }
        />
      ) : (
        <Input
          id={`recipe-configuration-${field.key}`}
          type={field.type === "number" ? "number" : "text"}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}
      {field.description && <p className="text-sm text-muted-foreground">{field.description}</p>}
    </div>
  );
}

export function RecipeConfigurationDialog({
  recipe,
  installation,
  values,
  onValuesChange,
  onClose,
  onSubmit,
  isLoading,
  submitText,
}: RecipeConfigurationDialogProps) {
  return (
    <FormDialog
      open={recipe !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={recipe ? `Configure ${recipe.title}` : "Configure recipe"}
      onSubmit={onSubmit}
      submitText={submitText ?? (installation ? "Save configuration" : "Install recipe")}
      isLoading={isLoading}
      submitDisabled={
        recipe ? isRequiredRecipeConfigurationMissing(recipe.configurationFields, values) : false
      }
    >
      {recipe?.configurationFields.length ? (
        recipe.configurationFields.map((field) => (
          <RecipeConfigurationFieldInput
            key={field.key}
            field={field}
            value={values[field.key] ?? formatRecipeConfigurationValue(field, {})}
            onChange={(value) =>
              onValuesChange({
                ...values,
                [field.key]: value,
              })
            }
          />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          This recipe does not need saved configuration.
        </p>
      )}
    </FormDialog>
  );
}

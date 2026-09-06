import type { RenderableTool } from "@ngriffin_uk/polychat-schemas";

import { FormField } from "./FormField";

interface FormStepProps {
  step: RenderableTool["formSchema"]["steps"][0];
  formData: Record<string, any>;
  onChange: (id: string, value: any) => void;
  errors: Record<string, string>;
}

export const FormStep = ({ step, formData, onChange, errors }: FormStepProps) => {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold text-foreground">{step.title}</h2>

      {step.description && <p className="mb-6 text-muted-foreground">{step.description}</p>}

      <div className="space-y-4">
        {step.fields.map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={formData[field.id]}
            onChange={onChange}
            error={errors[field.id]}
          />
        ))}
      </div>
    </div>
  );
};

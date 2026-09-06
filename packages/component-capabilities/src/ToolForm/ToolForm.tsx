import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { getToolFormStepErrors, type RunnableTool } from "@ngriffin_uk/polychat-schemas";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { getCardGradient, getIcon, getIconContainerClass } from "../capability-theme";
import { FormStep } from "./FormStep";

interface ToolFormProps {
  tool: RunnableTool;
  onSubmit: (formData: Record<string, any>) => Promise<Record<string, any>>;
  onComplete: (result: Record<string, any>) => void;
  isSubmitting?: boolean;
}

export const ToolForm = ({
  tool,
  onSubmit,
  onComplete,
  isSubmitting: externalIsSubmitting = false,
}: ToolFormProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);

  const isSubmitting = externalIsSubmitting || internalIsSubmitting;

  useEffect(() => {
    const initialData: Record<string, any> = {};

    for (const step of tool.formSchema.steps) {
      for (const field of step.fields) {
        if (field.defaultValue !== undefined) {
          initialData[field.id] = field.defaultValue;
        }
      }
    }

    setFormData(initialData);
  }, [tool]);

  const handleFieldChange = (id: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));

    if (errors[id]) {
      setErrors((prev) => {
        const newErrors = { ...prev };

        delete newErrors[id];

        return newErrors;
      });
    }
  };

  const validateStep = (stepIndex: number): boolean => {
    const step = tool.formSchema.steps[stepIndex];
    const newErrors = getToolFormStepErrors(step, formData);

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStepIndex)) {
      setCurrentStepIndex((prev) => Math.min(prev + 1, tool.formSchema.steps.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStepIndex)) {
      return;
    }

    try {
      setInternalIsSubmitting(true);
      const result = await onSubmit(formData);

      onComplete(result);
    } catch (error) {
      console.error("Error submitting form:", error);
      setErrors({
        form:
          error instanceof Error ? error.message : "An error occurred while submitting the form",
      });
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  const currentStep = tool.formSchema.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === tool.formSchema.steps.length - 1;

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className={cn(
          "rounded-xl border border-border bg-surface-elevated p-5 transition-all duration-200 hover:border-border-strong hover:shadow-lg",
          "bg-gradient-to-br",
          getCardGradient(tool.theme),
          "mb-6",
        )}
      >
        <div className="mb-6">
          <div className="mb-4 flex items-center space-x-4">
            <div className={cn("rounded-lg p-3 shadow-sm", getIconContainerClass(tool.theme))}>
              {getIcon(tool.icon, tool.theme)}
            </div>
            <div>
              <h1 className={cn("mb-2 text-2xl font-bold text-foreground")}>{tool.name}</h1>
              <p className={cn("text-muted-foreground")}>{tool.description}</p>
            </div>
          </div>

          {tool.formSchema.steps.length > 1 && (
            <>
              <div className="mt-6 flex items-center justify-between">
                {tool.formSchema.steps.map((step, index) => (
                  <div key={step.id} className="flex flex-col items-center">
                    <div
                      className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
                        index < currentStepIndex
                          ? "bg-success text-background"
                          : index === currentStepIndex
                            ? "bg-active-work text-background"
                            : "bg-selection text-muted-foreground"
                      }`}
                    >
                      {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className="text-xs text-muted-foreground">{step.title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 rounded-full bg-selection">
                <div
                  className="h-full rounded-full bg-active-work transition-all duration-300"
                  style={{
                    width: `${((currentStepIndex + 1) / tool.formSchema.steps.length) * 100}%`,
                  }}
                />
              </div>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rounded-lg bg-surface-elevated p-5">
            <FormStep
              step={currentStep}
              formData={formData}
              onChange={handleFieldChange}
              errors={errors}
            />

            {errors.form && (
              <div className="mt-4 rounded-md border border-failure/45 bg-failure/12 p-3 text-failure">
                {errors.form}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-between">
            {!isFirstStep && (
              <Button
                type="button"
                variant="secondary"
                onClick={handlePrevious}
                disabled={isSubmitting}
              >
                Previous
              </Button>
            )}

            <div className="ml-auto">
              {isLastStep ? (
                <Button
                  type="submit"
                  variant="primary"
                  className={"flex items-center"}
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? "Processing..." : "Submit"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNext}
                  variant="primary"
                  disabled={isSubmitting}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

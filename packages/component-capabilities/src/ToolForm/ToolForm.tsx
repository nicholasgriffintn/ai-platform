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
    <div className="max-w-3xl mx-auto">
      <div
        className={cn(
          "border border-border rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-surface-elevated hover:border-border-strong",
          "bg-gradient-to-br",
          getCardGradient(tool.theme),
          "mb-6",
        )}
      >
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className={cn("p-3 rounded-lg shadow-sm", getIconContainerClass(tool.theme))}>
              {getIcon(tool.icon, tool.theme)}
            </div>
            <div>
              <h1 className={cn("text-2xl font-bold mb-2 text-foreground")}>{tool.name}</h1>
              <p className={cn("text-muted-foreground")}>{tool.description}</p>
            </div>
          </div>

          {tool.formSchema.steps.length > 1 && (
            <>
              <div className="flex items-center justify-between mt-6">
                {tool.formSchema.steps.map((step, index) => (
                  <div key={step.id} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                        index < currentStepIndex
                          ? "bg-success text-background"
                          : index === currentStepIndex
                            ? "bg-active-work text-background"
                            : "bg-selection text-muted-foreground"
                      }`}
                    >
                      {index < currentStepIndex ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    <span className="text-xs text-muted-foreground">{step.title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 bg-selection rounded-full">
                <div
                  className="h-full bg-active-work rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentStepIndex + 1) / tool.formSchema.steps.length) * 100}%`,
                  }}
                />
              </div>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-surface-elevated p-5 rounded-lg">
            <FormStep
              step={currentStep}
              formData={formData}
              onChange={handleFieldChange}
              errors={errors}
            />

            {errors.form && (
              <div className="mt-4 p-3 bg-failure/12 text-failure rounded-md border border-failure/45">
                {errors.form}
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
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

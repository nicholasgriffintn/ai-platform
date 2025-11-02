import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import type { AppSchema } from "~/types/apps";
import { getCardGradient, getIcon, getIconContainerClass } from "../utils";
import { FormStep } from "./FormStep";

interface DynamicFormProps {
	app: AppSchema;
	onSubmit: (formData: Record<string, any>) => Promise<Record<string, any>>;
	onComplete: (result: Record<string, any>) => void;
	isSubmitting?: boolean;
}

export const DynamicForm = ({
	app,
	onSubmit,
	onComplete,
	isSubmitting: externalIsSubmitting = false,
}: DynamicFormProps) => {
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [formData, setFormData] = useState<Record<string, any>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);

	const isSubmitting = externalIsSubmitting || internalIsSubmitting;

	useEffect(() => {
		const initialData: Record<string, any> = {};

		for (const step of app.formSchema.steps) {
			for (const field of step.fields) {
				if (field.defaultValue !== undefined) {
					initialData[field.id] = field.defaultValue;
				}
			}
		}

		setFormData(initialData);
	}, [app]);

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
		const step = app.formSchema.steps[stepIndex];
		const newErrors: Record<string, string> = {};

		let isValid = true;

		for (const field of step.fields) {
			if (field.required) {
				const value = formData[field.id];
				if (value === undefined || value === null || value === "") {
					newErrors[field.id] = `${field.label} is required`;
					isValid = false;
				}
			}

			if (
				formData[field.id] !== undefined &&
				formData[field.id] !== null &&
				formData[field.id] !== ""
			) {
				const value = formData[field.id];

				switch (field.type) {
					case "text":
					case "textarea":
						if (
							field.validation?.pattern &&
							!new RegExp(field.validation.pattern).test(value)
						) {
							newErrors[field.id] = `${field.label} has an invalid format`;
							isValid = false;
						}

						if (
							field.validation?.minLength &&
							value.length < field.validation.minLength
						) {
							newErrors[field.id] =
								`${field.label} must be at least ${field.validation.minLength} characters`;
							isValid = false;
						}

						if (
							field.validation?.maxLength &&
							value.length > field.validation.maxLength
						) {
							newErrors[field.id] =
								`${field.label} must be at most ${field.validation.maxLength} characters`;
							isValid = false;
						}
						break;

					case "number":
						if (
							field.validation?.min !== undefined &&
							value < field.validation.min
						) {
							newErrors[field.id] =
								`${field.label} must be at least ${field.validation.min}`;
							isValid = false;
						}

						if (
							field.validation?.max !== undefined &&
							value > field.validation.max
						) {
							newErrors[field.id] =
								`${field.label} must be at most ${field.validation.max}`;
							isValid = false;
						}
						break;

					case "select":
						if (
							field.validation?.options &&
							!field.validation.options.some((option) => option.value === value)
						) {
							newErrors[field.id] = `${field.label} has an invalid option`;
							isValid = false;
						}
						break;

					case "multiselect":
						if (field.validation?.options && Array.isArray(value)) {
							const validValues = field.validation.options.map(
								(option) => option.value,
							);
							for (const item of value) {
								if (!validValues.includes(item)) {
									newErrors[field.id] = `${field.label} has an invalid option`;
									isValid = false;
									break;
								}
							}
						}
						break;
				}
			}
		}

		setErrors(newErrors);
		return isValid;
	};

	const handleNext = () => {
		if (validateStep(currentStepIndex)) {
			setCurrentStepIndex((prev) =>
				Math.min(prev + 1, app.formSchema.steps.length - 1),
			);
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
					error instanceof Error
						? error.message
						: "An error occurred while submitting the form",
			});
		} finally {
			setInternalIsSubmitting(false);
		}
	};

	const currentStep = app.formSchema.steps[currentStepIndex];
	const isFirstStep = currentStepIndex === 0;
	const isLastStep = currentStepIndex === app.formSchema.steps.length - 1;

	return (
		<div className="max-w-3xl mx-auto">
			<div
				className={cn(
					"border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-off-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600",
					"bg-gradient-to-br",
					getCardGradient(app.theme),
					"mb-6",
				)}
			>
				<div className="mb-6">
					<div className="flex items-center space-x-4 mb-4">
						<div
							className={cn(
								"p-3 rounded-lg shadow-sm",
								getIconContainerClass(app.theme),
							)}
						>
							{getIcon(app.icon, app.theme)}
						</div>
						<div>
							<h1
								className={cn(
									"text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-50",
								)}
							>
								{app.name}
							</h1>
							<p className={cn("text-zinc-600 dark:text-zinc-300")}>
								{app.description}
							</p>
							{app.costPerCall !== undefined && (
								<p
									className={cn(
										"text-sm text-zinc-500 dark:text-zinc-400 mt-1",
									)}
								>
									Cost per run:{" "}
									{app.costPerCall === 0
										? "Free"
										: `${app.costPerCall} ${app.costPerCall === 1 ? "request" : "requests"}`}
								</p>
							)}
						</div>
					</div>

					{app.formSchema.steps.length > 1 && (
						<>
							<div className="flex items-center justify-between mt-6">
								{app.formSchema.steps.map((step, index) => (
									<div key={step.id} className="flex flex-col items-center">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
												index < currentStepIndex
													? "bg-green-500 dark:bg-green-600 text-white"
													: index === currentStepIndex
														? "bg-blue-500 dark:bg-blue-600 text-white"
														: "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
											}`}
										>
											{index < currentStepIndex ? (
												<Check className="w-4 h-4" />
											) : (
												index + 1
											)}
										</div>
										<span className="text-xs text-zinc-600 dark:text-zinc-300">
											{step.title}
										</span>
									</div>
								))}
							</div>
							<div className="mt-4 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full">
								<div
									className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all duration-300"
									style={{
										width: `${((currentStepIndex + 1) / app.formSchema.steps.length) * 100}%`,
									}}
								/>
							</div>
						</>
					)}
				</div>

				<form onSubmit={handleSubmit}>
					<div className="bg-off-white/80 dark:bg-zinc-800/80 p-5 rounded-lg">
						<FormStep
							step={currentStep}
							formData={formData}
							onChange={handleFieldChange}
							errors={errors}
						/>

						{errors.form && (
							<div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800">
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

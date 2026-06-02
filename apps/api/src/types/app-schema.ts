import { FieldType as SharedFieldType } from "@assistant/schemas";

export const FieldType = SharedFieldType;

export {
	dynamicAppFormFieldSchema as formFieldSchema,
	dynamicAppFormSchema as formSchema,
	dynamicAppFormStepSchema as formStepSchema,
	dynamicAppResponseFieldSchema as responseFieldSchema,
	dynamicAppResponseSchema as responseSchema,
	dynamicAppSchema as appSchema,
} from "@assistant/schemas";

export type {
	AppSchema,
	AppTheme,
	DynamicAppFormField as FormField,
	DynamicAppFormSchema as FormSchema,
	DynamicAppFormStep as FormStep,
	DynamicAppResponseSchema as ResponseSchema,
} from "@assistant/schemas";

export type FieldType = import("@assistant/schemas").FieldType;

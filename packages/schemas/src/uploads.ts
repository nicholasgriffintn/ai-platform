import z from "zod/v4";

export const markdownDescriptionLanguageSchema = z.enum([
	"en",
	"it",
	"de",
	"es",
	"fr",
	"pt",
]);

export const markdownConversionOptionsSchema = z.object({
	image: z
		.object({
			descriptionLanguage: markdownDescriptionLanguageSchema.optional(),
		})
		.optional(),
	html: z
		.object({
			hostname: z.string().trim().min(1).optional(),
			cssSelector: z.string().trim().min(1).optional(),
		})
		.optional(),
	pdf: z
		.object({
			metadata: z.boolean().optional(),
		})
		.optional(),
});

export type MarkdownConversionOptions = z.infer<
	typeof markdownConversionOptionsSchema
>;

export const uploadRequestSchema = z.object({
	file: z.any().refine((file) => file && file instanceof File, {
		error: "File is required",
	}),
	file_type: z.enum(["image", "document", "audio", "code"]),
});

export const uploadResponseSchema = z.object({
	url: z.string(),
	type: z.enum(["image", "document", "audio", "code", "markdown_document"]),
	name: z.string().optional(),
	markdown: z.string().optional(),
});

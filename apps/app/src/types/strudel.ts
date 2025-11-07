export type StrudelStyle =
	| "techno"
	| "ambient"
	| "house"
	| "jazz"
	| "drums"
	| "experimental";

export type StrudelComplexity = "simple" | "medium" | "complex";

export interface StrudelPattern {
	id: string;
	name: string;
	code: string;
	description?: string;
	tags?: string[];
	createdAt: string;
	updatedAt: string;
}

export interface GenerateStrudelRequest {
	prompt: string;
	style?: StrudelStyle;
	tempo?: number;
	complexity?: StrudelComplexity;
	model?: string;
}

export interface GenerateStrudelResponse {
	code: string;
	explanation?: string;
}

export interface SaveStrudelPatternInput {
	code: string;
	name: string;
	description?: string;
	tags?: string[];
}

export interface UpdateStrudelPatternInput {
	code?: string;
	name?: string;
	description?: string;
	tags?: string[];
}

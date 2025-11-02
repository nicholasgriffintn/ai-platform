export interface Question {
	id: string;
	text: string;
	question: string;
	category: string;
	expectedAnswer?: string;
}

export type QuestionPool = Record<string, Omit<Question, "category">[]>;

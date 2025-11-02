import type { RagOptions } from "./chat";

export type EmbeddingVector = {
	id: string;
	values: number[] | Float32Array;
	metadata: Record<string, any>;
};

export type EmbeddingMatch = {
	id: string;
	score: number;
	metadata: Record<string, any>;
	title?: string;
	content?: string;
};

export type EmbeddingQueryResult = {
	matches: EmbeddingMatch[];
	count: number;
};

export type EmbeddingMutationResult = {
	status: string;
	error: string | null;
};

export interface EmbeddingProvider {
	generate(
		type: string,
		content: string,
		id: string,
		metadata: Record<string, any>,
	): Promise<EmbeddingVector[]>;

	insert(
		embeddings: EmbeddingVector[],
		options: RagOptions,
	): Promise<EmbeddingMutationResult>;

	delete(ids: string[]): Promise<EmbeddingMutationResult>;

	getQuery(query: string): Promise<{ data: any; status: { success: boolean } }>;

	getMatches(
		queryVector: any,
		options: RagOptions,
	): Promise<EmbeddingQueryResult>;

	searchSimilar(
		query: string,
		options?: RagOptions,
	): Promise<
		{
			title: string;
			content: string;
			metadata: Record<string, any>;
			score: number;
			type: string;
		}[]
	>;
}

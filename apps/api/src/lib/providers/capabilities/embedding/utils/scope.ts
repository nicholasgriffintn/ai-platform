import type { RagOptions } from "~/types";

const hasKeys = (value: unknown): value is Record<string, any> =>
	!!value && typeof value === "object" && Object.keys(value).length > 0;

export const getEmbeddingContentType = (options: RagOptions) =>
	options.contentType ?? options.embeddingType ?? options.type;

const getUserId = (options: RagOptions) =>
	options.userId === undefined || options.userId === null ? undefined : String(options.userId);

const isOwnedUserNamespace = (namespace: string | undefined, userId: string | undefined) =>
	!!namespace &&
	!!userId &&
	[`user_kb_${userId}`, `memory_user_${userId}`, `sandbox_runs_user_${userId}`].includes(namespace);

const getMetadataUserIdFilter = (options: RagOptions) => {
	const userId = getUserId(options);
	return isOwnedUserNamespace(options.namespace, userId) ? undefined : userId;
};

export const withEmbeddingScopeMetadata = (
	metadata: Record<string, any>,
	options: RagOptions,
): Record<string, any> => ({
	...metadata,
	...(options.namespace && { namespace: options.namespace }),
	...(getUserId(options) && { userId: getUserId(options) }),
});

export const buildVectorizeMetadataFilter = (options: RagOptions) => {
	const contentType = getEmbeddingContentType(options);
	const userId = getMetadataUserIdFilter(options);
	const filter = {
		...(hasKeys(options.filter) ? options.filter : {}),
		...(contentType && { type: contentType }),
		...(userId && { userId }),
	};

	return hasKeys(filter) ? filter : undefined;
};

export const buildS3VectorsMetadataFilter = (options: RagOptions) => {
	const filters: Record<string, any>[] = [];
	const contentType = getEmbeddingContentType(options);
	const userId = getMetadataUserIdFilter(options);

	if (hasKeys(options.filter)) {
		filters.push(options.filter);
	}

	if (options.namespace) {
		filters.push({ namespace: { $eq: options.namespace } });
	}

	if (contentType) {
		filters.push({ type: { $eq: contentType } });
	}

	if (userId) {
		filters.push({ userId: { $eq: userId } });
	}

	if (filters.length === 0) {
		return undefined;
	}

	return filters.length === 1 ? filters[0] : { $and: filters };
};

export const buildBedrockRetrievalFilter = (options: RagOptions) => {
	const filters: Record<string, unknown>[] = [];
	const contentType = options.contentType ?? options.embeddingType;
	const userId = getMetadataUserIdFilter(options);

	if (hasKeys(options.filter)) {
		filters.push(options.filter);
	}

	if (options.namespace) {
		filters.push({ equals: { key: "namespace", value: options.namespace } });
	}

	if (contentType) {
		filters.push({ equals: { key: "type", value: contentType } });
	}

	if (userId) {
		filters.push({ equals: { key: "userId", value: userId } });
	}

	if (filters.length === 0) {
		return null;
	}

	return filters.length === 1 ? filters[0] : { andAll: filters };
};

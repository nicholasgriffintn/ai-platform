interface ResolveResponseDataOptions {
	hasAppSchema: boolean;
	responseType?: string;
}

export function resolveResponseData(
	result: Record<string, any>,
	{ hasAppSchema, responseType }: ResolveResponseDataOptions,
) {
	const resultData = result.data || result;

	if (hasAppSchema && resultData?.result) {
		return resultData.result;
	}

	if (responseType && "result" in resultData) {
		return resultData.result;
	}

	if (responseType && "results" in resultData) {
		return resultData.results;
	}

	return resultData;
}

export function resolveTextResponseData(result: Record<string, any>, responseData: unknown) {
	if (typeof responseData === "string") {
		return { content: responseData };
	}

	if (responseData && typeof responseData === "object" && "content" in responseData) {
		const content = responseData.content;
		return {
			content: typeof content === "string" ? content : JSON.stringify(content, null, 2),
		};
	}

	if (typeof result.content === "string") {
		return { content: result.content };
	}

	return { content: "" };
}

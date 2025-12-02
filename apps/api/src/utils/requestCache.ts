export type RequestCache = Map<string, unknown>;

export function createRequestCache(): RequestCache {
	return new Map<string, unknown>();
}

export function memoizeRequest<T>(
	cache: RequestCache | undefined,
	key: string,
	factory: () => Promise<T> | T,
): Promise<T> {
	if (!cache) {
		return Promise.resolve(factory());
	}

	if (cache.has(key)) {
		return cache.get(key) as Promise<T>;
	}

	const promise = Promise.resolve(factory());
	cache.set(key, promise);

	promise.catch(() => {
		cache.delete(key);
	});

	return promise;
}

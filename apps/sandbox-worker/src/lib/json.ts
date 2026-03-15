export function safeParseJson<T = unknown>(jsonString: string): T | null {
	try {
		return JSON.parse(jsonString) as T;
	} catch {
		return null;
	}
}

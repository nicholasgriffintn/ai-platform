export function randomHex(len: number): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.getRandomValues === "function"
	) {
		const bytes = new Uint8Array(Math.ceil(len / 2));
		crypto.getRandomValues(bytes);
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.slice(0, len)
			.toUpperCase();
	}

	return Array.from({ length: len }, () =>
		Math.floor(Math.random() * 16)
			.toString(16)
			.toUpperCase(),
	).join("");
}

export function randomUUIDLike(): string {
	return [8, 4, 4, 4, 12].map((n) => randomHex(n)).join("-");
}

export function generateId(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return randomUUIDLike();
}

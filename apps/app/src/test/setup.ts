import "@testing-library/jest-dom";

const readableStreamConstructor = new Response("").body?.constructor;

if (readableStreamConstructor) {
	Object.defineProperty(globalThis, "ReadableStream", {
		configurable: true,
		value: readableStreamConstructor,
		writable: true,
	});
}

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = "";

	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = bytes.subarray(index, index + chunkSize);
		binary += String.fromCharCode.apply(null, Array.from(chunk));
	}

	return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
	const binString = atob(base64);
	return Uint8Array.from(binString, (char) => char.charCodeAt(0));
}

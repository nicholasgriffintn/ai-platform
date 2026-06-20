const QR_IMAGE_SERVICE_URL = "http://pashi.app/api/qr";
const QR_SIZE_PATTERN = /^([1-9]\d{1,3})x([1-9]\d{1,3})$/;

export const DEFAULT_QR_SIZE = "520x520";
export const MAX_QR_PAYLOAD_LENGTH = 2000;

export interface QrSize {
	height: number;
	label: string;
	width: number;
}

export function normaliseQrSize(value: unknown): QrSize {
	if (typeof value !== "string" || !value.trim()) {
		return { height: 520, label: DEFAULT_QR_SIZE, width: 520 };
	}

	const trimmed = value.trim().toLowerCase();
	const match = trimmed.match(QR_SIZE_PATTERN);
	if (!match) {
		return { height: 520, label: DEFAULT_QR_SIZE, width: 520 };
	}

	const width = Number.parseInt(match[1], 10);
	const height = Number.parseInt(match[2], 10);
	if (width > 1000 || height > 1000) {
		return { height: 520, label: DEFAULT_QR_SIZE, width: 520 };
	}

	return { height, label: `${width}x${height}`, width };
}

export function assertQrPayloadLength(payload: string): number {
	if (payload.length > MAX_QR_PAYLOAD_LENGTH) {
		throw new Error(`QR payloads are limited to ${MAX_QR_PAYLOAD_LENGTH} characters.`);
	}

	return payload.length;
}

export function buildQrImageUrl(payload: string, size: string): string {
	const url = new URL(QR_IMAGE_SERVICE_URL);
	url.searchParams.set("data", payload);
	url.searchParams.set("format", "png");
	url.searchParams.set("size", size);
	return url.toString();
}

export function isPashiQrPngUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}

	if (url.origin !== "http://pashi.app" || url.pathname !== "/api/qr") {
		return false;
	}

	if (url.searchParams.get("format") !== "png") {
		return false;
	}

	const payload = url.searchParams.get("data");
	if (!payload) {
		return false;
	}

	try {
		assertQrPayloadLength(payload);
	} catch {
		return false;
	}

	normaliseQrSize(url.searchParams.get("size"));
	return true;
}

import { createHash, createHmac } from "crypto";

export function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export function hmac(key: string | Buffer, value: string): Buffer {
	return createHmac("sha256", key).update(value).digest();
}

export function hmacHex(key: string | Buffer, value: string): string {
	return createHmac("sha256", key).update(value).digest("hex");
}

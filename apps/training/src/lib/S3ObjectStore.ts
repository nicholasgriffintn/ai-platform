import { getSignatureKey } from "../utils/aws.js";
import { hmacHex, sha256Hex } from "../utils/crypto.js";

export interface AwsS3Credentials {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
}

interface S3ObjectStoreOptions {
	bucket: string;
	region: string;
	credentials: AwsS3Credentials;
	fetcher?: typeof fetch;
}

interface PutObjectOptions {
	key: string;
	body: BodyInit;
	contentType?: string;
}

interface SignS3RequestOptions {
	method: string;
	url: URL;
	contentType?: string;
}

const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export class S3ObjectStore {
	private readonly fetcher: typeof fetch;

	constructor(private readonly options: S3ObjectStoreOptions) {
		this.fetcher = options.fetcher || fetch;
	}

	static joinKey(...parts: string[]): string {
		return parts
			.map((part) => part.replace(/^\/+|\/+$/g, ""))
			.filter(Boolean)
			.join("/");
	}

	getPrefixUri(keyPrefix: string): string {
		return `s3://${this.options.bucket}/${trimKey(keyPrefix)}/`;
	}

	async hasObject(key: string): Promise<boolean> {
		const url = this.getObjectUrl(key);
		const response = await this.fetcher(url, {
			method: "HEAD",
			headers: this.signRequest({
				method: "HEAD",
				url,
			}),
		});

		if (response.status === 404) return false;
		if (!response.ok) {
			throw new Error(
				`S3 HeadObject failed (${response.status}) for s3://${this.options.bucket}/${key}`,
			);
		}

		return true;
	}

	async putObject({ key, body, contentType }: PutObjectOptions): Promise<void> {
		const url = this.getObjectUrl(key);
		const response = await this.fetcher(url, {
			method: "PUT",
			headers: this.signRequest({
				method: "PUT",
				url,
				contentType,
			}),
			body,
		});

		if (!response.ok) {
			throw new Error(
				`S3 PutObject failed (${response.status}) for s3://${this.options.bucket}/${key}`,
			);
		}
	}

	private getObjectUrl(key: string): URL {
		return new URL(
			`https://${this.options.bucket}.s3.${this.options.region}.amazonaws.com/${encodeKey(key)}`,
		);
	}

	private signRequest({ method, url, contentType }: SignS3RequestOptions): Record<string, string> {
		const now = new Date();
		const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
		const dateStamp = amzDate.slice(0, 8);
		const headers: Record<string, string> = {
			host: url.host,
			"x-amz-content-sha256": UNSIGNED_PAYLOAD,
			"x-amz-date": amzDate,
		};
		if (contentType) headers["content-type"] = contentType;
		if (this.options.credentials.sessionToken) {
			headers["x-amz-security-token"] = this.options.credentials.sessionToken;
		}

		const signedHeaders = Object.keys(headers).sort().join(";");
		const canonicalHeaders = Object.keys(headers)
			.sort()
			.map((key) => `${key}:${headers[key]}\n`)
			.join("");
		const canonicalRequest = [
			method,
			url.pathname || "/",
			getCanonicalQueryString(url),
			canonicalHeaders,
			signedHeaders,
			UNSIGNED_PAYLOAD,
		].join("\n");
		const credentialScope = `${dateStamp}/${this.options.region}/s3/aws4_request`;
		const stringToSign = [
			"AWS4-HMAC-SHA256",
			amzDate,
			credentialScope,
			sha256Hex(canonicalRequest),
		].join("\n");
		const signingKey = getSignatureKey(
			this.options.credentials.secretAccessKey,
			dateStamp,
			this.options.region,
			"s3",
		);
		const signature = hmacHex(signingKey, stringToSign);

		return {
			Host: headers.host,
			"X-Amz-Content-Sha256": UNSIGNED_PAYLOAD,
			"X-Amz-Date": headers["x-amz-date"],
			...(contentType ? { "Content-Type": contentType } : {}),
			...(this.options.credentials.sessionToken
				? { "X-Amz-Security-Token": this.options.credentials.sessionToken }
				: {}),
			Authorization: `AWS4-HMAC-SHA256 Credential=${this.options.credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
		};
	}
}

function encodeKey(key: string): string {
	return key.split("/").map(encodeURIComponent).join("/");
}

function getCanonicalQueryString(url: URL): string {
	return [...url.searchParams.entries()]
		.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
			leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
		)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join("&");
}

function trimKey(value: string): string {
	return value.replace(/^\/+|\/+$/g, "");
}

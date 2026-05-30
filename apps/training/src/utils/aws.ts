import { sha256Hex, hmac, hmacHex } from "./crypto.js";

export function getSignatureKey(
	secretAccessKey: string,
	dateStamp: string,
	region: string,
	service: string,
): Buffer {
	const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
	const regionKey = hmac(dateKey, region);
	const serviceKey = hmac(regionKey, service);
	return hmac(serviceKey, "aws4_request");
}

interface SignAwsJsonRequestOptions {
	url: string;
	target: string;
	payload: string;
	region: string;
	service: string;
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
}

export function signAwsJsonRequest(options: SignAwsJsonRequestOptions): Record<string, string> {
	const url = new URL(options.url);
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
	const dateStamp = amzDate.slice(0, 8);
	const headers: Record<string, string> = {
		"content-type": "application/x-amz-json-1.1",
		host: url.host,
		"x-amz-date": amzDate,
		"x-amz-target": options.target,
	};
	if (options.sessionToken) headers["x-amz-security-token"] = options.sessionToken;

	const signedHeaders = Object.keys(headers).sort().join(";");
	const canonicalHeaders = Object.keys(headers)
		.sort()
		.map((key) => `${key}:${headers[key]}\n`)
		.join("");
	const canonicalRequest = [
		"POST",
		url.pathname || "/",
		"",
		canonicalHeaders,
		signedHeaders,
		sha256Hex(options.payload),
	].join("\n");
	const credentialScope = `${dateStamp}/${options.region}/${options.service}/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex(canonicalRequest),
	].join("\n");
	const signingKey = getSignatureKey(
		options.secretAccessKey,
		dateStamp,
		options.region,
		options.service,
	);
	const signature = hmacHex(signingKey, stringToSign);

	return {
		"Content-Type": headers["content-type"],
		Host: headers.host,
		"X-Amz-Date": headers["x-amz-date"],
		"X-Amz-Target": headers["x-amz-target"],
		...(options.sessionToken ? { "X-Amz-Security-Token": options.sessionToken } : {}),
		Authorization: `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
	};
}

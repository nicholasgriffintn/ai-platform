import { redactSensitiveTokens } from "~/utils/redaction";

function formatResponseStatus(response: Response): string {
	return [response.status, response.statusText].filter(Boolean).join(" ");
}

async function readResponseBody(response: Response): Promise<string> {
	return response.text().catch(() => "");
}

export async function formatProviderError(source: unknown, message: string): Promise<string> {
	if (source instanceof Response) {
		const status = formatResponseStatus(source);
		const body = redactSensitiveTokens(await readResponseBody(source));
		const detail = [status, body].filter(Boolean).join(" - ");
		return detail ? `${message}: ${detail}` : message;
	}

	if (source instanceof Error) {
		return `${message}: ${redactSensitiveTokens(source.message)}`;
	}

	if (typeof source === "string") {
		return `${message}: ${redactSensitiveTokens(source)}`;
	}

	return message;
}

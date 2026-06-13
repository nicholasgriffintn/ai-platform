import { stringToBase64Url } from "~/utils/base64";
import { assertSafeEmailHeaderValue } from "~/utils/email";
import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

function buildEmailMessage(params: Record<string, unknown>) {
	const to = getStringParam(params, "to");
	const subject = getStringParam(params, "subject");
	const body = getStringParam(params, "body");
	if (!to || !subject || !body) {
		throw new AssistantError("to, subject, and body are required", ErrorType.PARAMS_ERROR, 400);
	}

	return [
		`To: ${assertSafeEmailHeaderValue("to", to)}`,
		`Subject: ${assertSafeEmailHeaderValue("subject", subject)}`,
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	].join("\r\n");
}

export async function executeGmailOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "search_messages") {
		const query = getStringParam(params, "query") ?? "";
		const maxResults = limitPositiveInteger(getNumberParam(params, "maxResults"), 10, 25);
		const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
		listUrl.searchParams.set("maxResults", String(maxResults));
		if (query) {
			listUrl.searchParams.set("q", query);
		}
		const listed = (await fetchConnectorJson({ url: listUrl.toString(), token })) as {
			messages?: Array<{ id?: string; threadId?: string }>;
		};
		const messages = await Promise.all(
			(listed.messages ?? []).slice(0, maxResults).map(async (message) => {
				if (!message.id) {
					return null;
				}
				const detailUrl = new URL(
					`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
				);
				detailUrl.searchParams.set("format", "metadata");
				detailUrl.searchParams.append("metadataHeaders", "From");
				detailUrl.searchParams.append("metadataHeaders", "Subject");
				detailUrl.searchParams.append("metadataHeaders", "Date");
				return fetchConnectorJson({ url: detailUrl.toString(), token });
			}),
		);
		return { messages: messages.filter(Boolean) };
	}

	if (operation === "create_draft") {
		const raw = stringToBase64Url(buildEmailMessage(params));
		return fetchConnectorJson({
			url: "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
			token,
			method: "POST",
			body: { message: { raw } },
		});
	}

	throw new AssistantError("Unsupported Gmail operation", ErrorType.PARAMS_ERROR, 400);
}

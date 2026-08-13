import { afterEach, describe, expect, it, vi } from "vitest";

import {
	deleteComposioTriggerInstance,
	getComposioTriggerType,
	listComposioTriggerTypes,
	setComposioTriggerEnabled,
	upsertComposioTriggerInstance,
} from "../composio-trigger-client";

const env = { COMPOSIO_API_KEY: "secret" } as any;

function jsonResponse(value: unknown, status = 200) {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("Composio trigger client", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("discovers only trigger types belonging to the requested toolkit", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse({
				items: [
					{
						slug: "GMAIL_NEW_MESSAGE",
						name: "New message",
						description: "When mail arrives",
						type: "poll",
						toolkit: { slug: "gmail" },
						config: { label: { type: "string" } },
					},
					{
						slug: "SLACK_NEW_MESSAGE",
						name: "Slack message",
						description: "Wrong toolkit",
						type: "webhook",
						toolkit: { slug: "slack" },
					},
				],
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(listComposioTriggerTypes({ env, toolkitSlug: "gmail" })).resolves.toEqual([
			{
				slug: "GMAIL_NEW_MESSAGE",
				name: "New message",
				description: "When mail arrives",
				kind: "poll",
				configuration: { label: { type: "string" } },
			},
		]);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("toolkit_slugs=gmail"),
			expect.objectContaining({ headers: expect.objectContaining({ "x-api-key": "secret" }) }),
		);
	});

	it("creates, pauses, deletes, and inspects trigger instances with scoped fields", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					slug: "GMAIL_NEW_MESSAGE",
					toolkit: { slug: "gmail" },
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ trigger_id: "ti_1" }))
			.mockResolvedValueOnce(jsonResponse({ enabled: false }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			getComposioTriggerType({ env, triggerSlug: "GMAIL_NEW_MESSAGE" }),
		).resolves.toEqual({ slug: "GMAIL_NEW_MESSAGE", toolkitSlug: "gmail" });
		await expect(
			upsertComposioTriggerInstance({
				env,
				triggerSlug: "GMAIL_NEW_MESSAGE",
				externalUserId: "polychat:test:user:42",
				connectedAccountId: "ca_1",
				configuration: { label: "inbox" },
			}),
		).resolves.toEqual({ triggerId: "ti_1" });
		await setComposioTriggerEnabled({ env, triggerId: "ti_1", enabled: false });
		await deleteComposioTriggerInstance({ env, triggerId: "ti_1" });

		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
			user_id: "polychat:test:user:42",
			connected_account_id: "ca_1",
			trigger_config: { label: "inbox" },
		});
		expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ enabled: false });
	});
});

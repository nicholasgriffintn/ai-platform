import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import type { IEnv, IRequest, IUser } from "~/types";
import { create_qr_code } from "../qr";

const env = {} as IEnv;
const user = { id: 42 } as IUser;
const request: IRequest = {
	env,
	user,
};
const toolContext: ToolExecutionContext = {
	completionId: "completion-id",
	env,
	user,
	request,
};

describe("create_qr_code", () => {
	it("creates a QR code image URL for the exact payload", async () => {
		const result = await create_qr_code.execute(
			{
				payload: "https://polychat.app/invite?team=alpha beta",
				size: "420x420",
			},
			toolContext,
		);

		expect(result).toEqual({
			status: "success",
			name: "create_qr_code",
			content:
				"QR code image URL created. Return this imageUrl to the user and include the encoded payload for review.",
			data: {
				imageUrl:
					"https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=https%3A%2F%2Fpolychat.app%2Finvite%3Fteam%3Dalpha+beta",
				payload: "https://polychat.app/invite?team=alpha beta",
				size: "420x420",
			},
		});
	});

	it("uses the default size when the requested size is invalid", async () => {
		const result = await create_qr_code.execute(
			{
				payload: "WIFI:T:WPA;S:Office;P:secret;;",
				size: "5000x5000",
			},
			toolContext,
		);

		expect(result.data).toMatchObject({
			size: "300x300",
		});
		expect(String(result.data?.imageUrl)).toContain("size=300x300");
	});

	it("rejects empty payloads", async () => {
		const result = await create_qr_code.execute({ payload: " " }, toolContext);

		expect(result).toMatchObject({
			status: "error",
			name: "create_qr_code",
			content: "Provide the exact text, URL, phone number, email, or Wi-Fi payload to encode.",
		});
	});
});

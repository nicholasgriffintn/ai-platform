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
	it("creates a Pashi QR code image URL for the exact payload", async () => {
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
				"QR code image created. Return this imageUrl to the user and include the encoded payload for review.",
			data: {
				imageUrl:
					"http://pashi.app/api/qr?data=https%3A%2F%2Fpolychat.app%2Finvite%3Fteam%3Dalpha+beta&format=png&size=420x420",
				mimeType: "image/png",
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
			imageUrl:
				"http://pashi.app/api/qr?data=WIFI%3AT%3AWPA%3BS%3AOffice%3BP%3Asecret%3B%3B&format=png&size=520x520",
			size: "520x520",
		});
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

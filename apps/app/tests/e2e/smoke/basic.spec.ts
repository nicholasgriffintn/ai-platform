import { expect, test } from "../fixtures/polychat-test";

test.describe("Release smoke", () => {
	test.use({ persona: "logged-out" });

	test("loads the Chat shell", async ({ homePage }) => {
		const response = await homePage.navigate("/chat");
		expect(response?.status()).toBeLessThan(400);
		await expect(homePage.chatInput).toBeVisible();
	});
});

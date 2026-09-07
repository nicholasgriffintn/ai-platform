import { findTeammateRole } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";

const ROLE = findTeammateRole("research-analyst");

test.describe("Hiring a teammate", () => {
  test.use({ persona: "pro" });

  test("hires a role with its brief and tools, and hires a description with none", async ({
    capabilitiesPage,
    page,
  }) => {
    if (!ROLE) {
      throw new Error("The research analyst role must exist");
    }

    await capabilitiesPage.open();
    await capabilitiesPage.openAddMenuWithKeyboard();
    await expect(capabilitiesPage.addMenuItem("Hire a teammate")).toBeFocused();
    await capabilitiesPage.selectAddMenuItemWithKeyboard();

    const dialog = page.getByRole("dialog", { name: "Hire a teammate" });

    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: new RegExp(`^${ROLE.title}`) }).click();
    await dialog
      .getByLabel("Anything else it should know", { exact: true })
      .fill("Always cite the release notes.");
    await dialog.getByRole("button", { name: "Hire", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });

    await expect(page).toHaveURL(/\/chat\/teammates\/[^/]+$/);
    const brief = page.getByLabel("System prompt", { exact: true });

    await expect(brief).toHaveValue(new RegExp(`^${ROLE.brief.slice(0, 40)}`));
    await expect(brief).toHaveValue(/Always cite the release notes\.$/);
    await expect(page.getByText(/Tools the teammate may call and skills it loads\./)).toContainText(
      /[1-9]\d* selected/,
    );

    await capabilitiesPage.open();
    await expect(capabilitiesPage.capabilityCard(ROLE.title)).toBeVisible();

    await capabilitiesPage.openAddMenuWithKeyboard();
    await capabilitiesPage.selectAddMenuItemWithKeyboard();
    await dialog.getByLabel("Name", { exact: true }).fill("Release describer");
    await dialog
      .getByLabel("Describe the job", { exact: true })
      .fill("Summarise release notes into one paragraph.");
    await dialog.getByRole("button", { name: "Hire", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });

    await expect(page).toHaveURL(/\/chat\/teammates\/[^/]+$/);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Release describer");
    await expect(page.getByLabel("System prompt", { exact: true })).toHaveValue(
      /Summarise release notes/,
    );
    await expect(page.getByText(/Tools the teammate may call and skills it loads\./)).toContainText(
      "0 selected",
    );

    await capabilitiesPage.open();
    await capabilitiesPage.deleteTeammateFromLibrary("Release describer");
    await capabilitiesPage.deleteTeammateFromLibrary(ROLE.title);
  });

  test("serves teammates where agents used to be and answers an at-mention", async ({
    capabilitiesPage,
    homePage,
    page,
    polychatApi,
  }) => {
    expect(await polychatApi.teammatesRouteStatus()).toBe(200);
    expect(await polychatApi.retiredAgentsRouteStatus()).toBe(404);

    const teammateName = "Release mention teammate";

    await capabilitiesPage.open();
    await capabilitiesPage.startNewTeammate();
    await capabilitiesPage.fillTeammateEditor({
      name: teammateName,
      description: "Answers release mentions.",
      systemPrompt: "Answer release questions concisely.",
      temperature: "0.2",
      maxSteps: "4",
    });
    await capabilitiesPage.createTeammate();

    await homePage.navigate("/chat");
    await homePage.chatInput.click();
    await homePage.chatInput.pressSequentially("@Release");
    await page.getByRole("button", { name: new RegExp(`^@${teammateName}`) }).waitFor();
    await expect
      .poll(
        async () => {
          if (new RegExp(teammateName).test(await homePage.chatInput.innerText())) {
            return true;
          }

          await homePage.chatInput.press("Enter");

          return new RegExp(teammateName).test(await homePage.chatInput.innerText());
        },
        { message: "the mention menu applies the teammate" },
      )
      .toBe(true);
    await homePage.chatInput.pressSequentially("answer through the mention");

    const completion = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/completions"),
    );

    await page.getByRole("button", { name: /send message/i }).click();
    const answered = await completion;

    expect(new URL(answered.url()).pathname).toMatch(/\/teammates\/[^/]+\/completions$/);
    expect(answered.status()).toBe(200);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:", {
      timeout: 20_000,
    });

    await capabilitiesPage.open();
    await capabilitiesPage.deleteTeammateFromLibrary(teammateName);
  });
});

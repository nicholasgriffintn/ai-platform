import {
  teammateResponseSchema,
  findTeammateRole,
  projectTaskListResponseSchema,
} from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { chooseDropdownOption, expectDropdownValue } from "../support/dropdown";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

const ROLE = findTeammateRole("research-analyst");

test.describe("Hiring a teammate", () => {
  test.use({ persona: "pro" });

  test("preserves colleague tools while setting and clearing automatic temperature", async ({
    page,
    capabilitiesPage,
  }) => {
    const enabledTools = ["create_task", "store_memory"];
    const response = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { name: "Automatic release colleague", enabled_tools: enabledTools },
    });

    await requireSuccessfulResponse(response, "Create an automatic colleague");
    const teammate = teammateResponseSchema.parse(await response.json());

    expect(teammate).toMatchObject({ kind: "colleague", temperature: null });
    const editorPath = `/chat/teammates/${teammate.id}`;

    await capabilitiesPage.navigate(editorPath);
    await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue("");
    for (const temperature of ["", "0.5", ""]) {
      await expectDropdownValue(page.getByLabel("Kind", { exact: true }), "Colleague");
      await page.getByLabel("Temperature", { exact: true }).fill(temperature);
      const saved = page.waitForResponse(
        (result) =>
          result.request().method() === "PUT" &&
          new URL(result.url()).pathname.endsWith(`/teammates/${teammate.id}`),
      );

      await page.getByRole("button", { name: "Save teammate", exact: true }).click();
      const result = await saved;

      await requireSuccessfulResponse(result, "Save colleague temperature");
      expect(teammateResponseSchema.parse(await result.json())).toMatchObject({
        kind: "colleague",
        temperature: temperature === "" ? null : Number(temperature),
        enabled_tools: enabledTools,
      });
      await capabilitiesPage.navigate(editorPath);
      await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(temperature);
    }
  });

  test("refuses a provider-requested task from a project bot without creating work", async ({
    page,
    workPage,
    homePage,
    polychatApi,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const projectId = workPage.currentProjectId();
    const projectPath = new URL(page.url()).pathname;
    const created = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        name: "Release boundary bot",
        kind: "bot",
        workspace_id: workspaceId,
        model: "groq-openai-gpt-oss-120b",
      },
    });

    await requireSuccessfulResponse(created, "Create project bot");
    const bot = teammateResponseSchema.parse(await created.json());

    expect((await polychatApi.addProjectCapability(projectId, "teammate", bot.id)).status).toBe(
      200,
    );
    const beforeResponse = await page.request.get(
      `${E2E_API_BASE_URL}/projects/${projectId}/tasks`,
    );

    await requireSuccessfulResponse(beforeResponse, "Read initial project tasks");
    const before = projectTaskListResponseSchema.parse(await beforeResponse.json());

    await homePage.navigate(`${projectPath}/chat?teammate=${bot.id}`);
    await homePage.sendMessage("File a release task from this bot");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Project task tools are only available in a project conversation.",
      { timeout: 20_000 },
    );
    const afterResponse = await page.request.get(`${E2E_API_BASE_URL}/projects/${projectId}/tasks`);

    await requireSuccessfulResponse(afterResponse, "Read project tasks after refusal");
    expect(projectTaskListResponseSchema.parse(await afterResponse.json())).toEqual(before);
  });

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

  test("preserves configured tools when the editor changes invocation behaviour", async ({
    page,
    capabilitiesPage,
  }) => {
    const created = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { name: "Restricted release bot", enabled_tools: ["create_task", "store_memory"] },
    });

    await requireSuccessfulResponse(created, "Create colleague with write tools");
    const teammate = teammateResponseSchema.parse(await created.json());

    expect(teammate.enabled_tools).toEqual(expect.arrayContaining(["create_task", "store_memory"]));
    await capabilitiesPage.navigate(`/chat/teammates/${teammate.id}`);
    await chooseDropdownOption(page.getByLabel("Kind", { exact: true }), "Bot");

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname.endsWith(`/teammates/${teammate.id}`),
    );

    await page.getByRole("button", { name: "Save teammate", exact: true }).click();
    const response = await saved;

    expect(response.status()).toBe(200);
    expect(teammateResponseSchema.parse(await response.json())).toMatchObject({
      kind: "bot",
      enabled_tools: ["create_task", "store_memory"],
    });
    await capabilitiesPage.navigate(`/chat/teammates/${teammate.id}`);
    await expectDropdownValue(page.getByLabel("Kind", { exact: true }), "Bot");
    await expect(page.getByText(/Tools the teammate may call and skills it loads/)).toContainText(
      "2 selected",
    );
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

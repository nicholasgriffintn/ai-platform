import type { Locator, Page, Response } from "@playwright/test";

import { BasePage } from "./BasePage";

export class WorkPage extends BasePage {
	constructor(page: Page) {
		super(page);
	}

	async open() {
		await this.navigate("/work");
		await this.page.getByRole("heading", { name: "Workspaces", exact: true }).waitFor();
	}

	async openWorkspace(name: string) {
		await this.page.getByRole("link", { name, exact: true }).first().click();
		await this.page.getByRole("heading", { name, exact: true }).waitFor();
	}

	async openWorkspaceProjects(name: string) {
		await this.clickElement(this.page.getByRole("link", { name: "Projects", exact: true }));
		await this.page.getByRole("heading", { name, exact: true }).waitFor();
	}

	async getWorkspacePath(name: string) {
		const href = await this.page
			.getByRole("link", { name, exact: true })
			.first()
			.getAttribute("href");
		if (!href) throw new Error(`Workspace ${name} has no route`);
		return href;
	}

	async openProject(name: string) {
		await this.page.getByRole("link", { name, exact: true }).first().click();
		await this.page.getByRole("heading", { name, exact: true }).waitFor();
	}

	async openProjectFromWorkspace(workspaceName: string, projectName: string) {
		await this.open();
		await this.openWorkspace(workspaceName);
		await this.openProject(projectName);
	}

	async getProjectPath(name: string) {
		const href = await this.page
			.getByRole("link", { name, exact: true })
			.first()
			.getAttribute("href");
		if (!href) throw new Error(`Project ${name} has no route`);
		return href;
	}

	async openProjectSurface(
		name:
			| "People"
			| "Governance"
			| "Experiences"
			| "Outputs"
			| "Sources"
			| "Activity"
			| "Capabilities",
	) {
		await this.clickElement(this.page.getByRole("link", { name, exact: true }));
		const heading = name === "People" ? "People & access" : name;
		await this.page.getByRole("heading", { name: heading, exact: true }).first().waitFor();
	}

	async openNewProjectConversation() {
		await this.clickElement(
			this.page.getByRole("link", { name: "New conversation", exact: true }).first(),
		);
		await this.page.getByRole("textbox", { name: "Message input" }).waitFor();
	}

	async returnToChat() {
		await this.clickElement(this.page.getByRole("link", { name: "Open Chat" }));
	}

	async createWorkspace(name: string, description: string) {
		await this.clickElement(this.page.getByRole("button", { name: "New workspace" }));
		const dialog = this.page.getByRole("dialog", { name: "Create a workspace" });
		await dialog.getByLabel("Workspace name").fill(name);
		await dialog.getByLabel("Description").fill(description);
		await dialog.getByRole("button", { name: "Create workspace" }).click();
		await this.page.getByRole("heading", { name, exact: true }).waitFor();
	}

	async createProject(name: string, description: string, instructions: string) {
		await this.clickElement(this.page.getByRole("button", { name: "New project" }));
		const dialog = this.page.getByRole("dialog", { name: "Create a project" });
		await dialog.getByLabel("Project name").fill(name);
		await dialog.getByLabel("Description").fill(description);
		await dialog.getByLabel("Project instructions").fill(instructions);
		await dialog.getByRole("button", { name: "Create project" }).click();
		await this.page.getByRole("heading", { name, exact: true }).waitFor();
	}

	async archiveProject() {
		await this.clickElement(this.page.getByRole("button", { name: "More project actions" }));
		await this.confirmArchiveProject();
	}

	private async confirmArchiveProject() {
		await this.clickElement(this.page.getByRole("menuitem", { name: "Archive" }));
		const confirmation = this.page.getByRole("dialog", { name: "Archive project" });
		await confirmation.getByRole("button", { name: "Archive project" }).click();
		await confirmation.waitFor({ state: "hidden" });
	}

	async deleteWorkspace() {
		await this.clickElement(this.page.getByRole("button", { name: "More workspace actions" }));
		await this.clickElement(this.page.getByRole("menuitem", { name: "Delete" }));
		const confirmation = this.page.getByRole("dialog", { name: "Delete workspace" });
		await confirmation.getByRole("button", { name: "Delete workspace" }).click();
		await confirmation.waitFor({ state: "hidden" });
	}

	async inviteAndRevokeMember(email: string) {
		await this.clickElement(this.page.getByRole("button", { name: "Invite person" }));
		const dialog = this.page.getByRole("dialog", { name: "Invite a teammate" });
		await dialog.getByLabel("Email address", { exact: true }).fill(email);
		await dialog.getByLabel("Role", { exact: true }).selectOption("member");
		await dialog.getByRole("button", { name: "Send invite" }).click();
		await dialog.getByText("Invitation ready", { exact: true }).waitFor();
		await dialog.getByRole("button", { name: "Done" }).click();
		await dialog.waitFor({ state: "hidden" });
		const invitation = this.page.getByText(email, { exact: true });
		await invitation.waitFor();
		await invitation
			.locator("xpath=ancestor::div[contains(@class,'items-center')][1]")
			.getByRole("button", { name: "Revoke" })
			.click();
		await invitation.waitFor({ state: "detached" });
	}

	async createMemberInvitation(email: string) {
		await this.clickElement(this.page.getByRole("button", { name: "Invite person" }));
		const dialog = this.page.getByRole("dialog", { name: "Invite a teammate" });
		await dialog.getByLabel("Email address", { exact: true }).fill(email);
		await dialog.getByLabel("Role", { exact: true }).selectOption("member");
		await dialog.getByRole("button", { name: "Send invite" }).click();
		await dialog.getByText("Invitation ready", { exact: true }).waitFor();
		const inviteUrl = await dialog.locator("input[readonly]").inputValue();
		await dialog.getByRole("button", { name: "Done" }).click();
		await dialog.waitFor({ state: "hidden" });
		return inviteUrl;
	}

	async acceptInvitation(inviteUrl: string) {
		await this.navigate(inviteUrl);
		await this.page.getByRole("heading", { name: "Welcome to Release Workspace" }).waitFor();
		await this.page.getByRole("button", { name: "Open workspace" }).click();
		await this.page.getByRole("heading", { name: "Release Workspace", exact: true }).waitFor();
	}

	async promoteAndRemoveMember(email: string) {
		await this.reload();
		const member = this.page.getByText(email, { exact: true });
		await member.waitFor();
		const memberRow = member.locator("xpath=ancestor::div[contains(@class,'items-center')][1]");
		const roleResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "PUT" &&
				/\/workspaces\/[^/]+\/members\/[^/]+$/.test(new URL(response.url()).pathname),
		);
		await memberRow.getByRole("combobox").selectOption("admin");
		await this.requireSuccessfulResponse(roleResponse, "Workspace member promotion");
		await memberRow.getByRole("combobox").waitFor();
		const demotionResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "PUT" &&
				/\/workspaces\/[^/]+\/members\/[^/]+$/.test(new URL(response.url()).pathname),
		);
		await memberRow.getByRole("combobox").selectOption("member");
		await this.requireSuccessfulResponse(demotionResponse, "Workspace member demotion");

		await memberRow.getByRole("button", { name: "Remove", exact: true }).click();
		const confirmation = this.page.getByRole("dialog", { name: "Remove workspace member" });
		const removalResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "DELETE" &&
				/\/workspaces\/[^/]+\/members\/[^/]+$/.test(new URL(response.url()).pathname),
		);
		await confirmation.getByRole("button", { name: "Remove member" }).click();
		await this.requireSuccessfulResponse(removalResponse, "Workspace member removal");
		await confirmation.waitFor({ state: "hidden" });
		await member.waitFor({ state: "detached" });
	}

	async updateProjectBrief(instructions: string) {
		await this.page.getByRole("button", { name: "Edit project brief" }).click();
		await this.page.getByLabel("Project brief", { exact: true }).fill(instructions);
		await this.page.getByRole("button", { name: "Save brief" }).click();
		await this.page.getByText(instructions, { exact: true }).waitFor();
	}

	async saveUseAndDeleteProjectTemplate(projectName: string) {
		await this.clickElement(this.page.getByRole("button", { name: "More project actions" }));
		await this.clickElement(this.page.getByRole("menuitem", { name: "Save template" }));
		await this.page.getByText("Project template saved", { exact: true }).waitFor();
		await this.confirmArchiveProject();
		await this.openProjectSurface("Governance");

		const template = this.page
			.getByRole("heading", { name: projectName, exact: true })
			.locator("xpath=ancestor::div[contains(@class,'items-center')][1]");
		const instantiateResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				/\/templates\/[^/]+\/instantiate$/.test(response.url()),
		);
		await template.getByRole("button", { name: "Use" }).click();
		const response = await instantiateResponse;
		if (!response.ok()) {
			throw new Error(
				`Project template instantiation failed with ${response.status()}: ${await response.text()}`,
			);
		}
		await this.page.waitForURL(/\/projects\/[^/]+$/);
		await this.page.getByRole("heading", { name: projectName, exact: true }).waitFor();
		await this.openProjectSurface("Governance");

		const savedTemplate = this.page
			.getByRole("heading", { name: projectName, exact: true })
			.locator("xpath=ancestor::div[contains(@class,'items-center')][1]");
		await savedTemplate.getByRole("button", { name: "Delete" }).click();
		const confirmation = this.page.getByRole("dialog", { name: "Delete project template" });
		await confirmation.getByRole("button", { name: "Delete template" }).click();
		await confirmation.waitFor({ state: "hidden" });
		await savedTemplate.waitFor({ state: "detached" });
	}

	private capabilityCard(name: string): Locator {
		return this.page
			.getByRole("heading", { name, exact: true })
			.or(this.page.getByText(name, { exact: true }))
			.first()
			.locator("xpath=ancestor::div[@data-slot='card'][1]");
	}

	private waitForCapabilityMutation(method: "POST" | "DELETE") {
		return this.page.waitForResponse(
			(response) =>
				response.request().method() === method &&
				(method === "POST"
					? /\/projects\/[^/]+\/capabilities$/.test(response.url())
					: /\/projects\/[^/]+\/capabilities\/[^/]+$/.test(response.url())),
		);
	}

	private async openCapability(name: string) {
		await this.openProjectSurface("Capabilities");
		await this.page.getByRole("searchbox", { name: "Search project capabilities" }).fill(name);
		return this.capabilityCard(name);
	}

	private async addCapability(name: string, reload: boolean) {
		let card = await this.openCapability(name);
		const addResponse = this.waitForCapabilityMutation("POST");
		await card.getByRole("button", { name: "Add to project" }).click();
		const response = await addResponse;
		if (!response.ok()) {
			throw new Error(`Capability add failed with ${response.status()}: ${await response.text()}`);
		}
		if (reload) {
			await this.reload();
			await this.page.getByRole("searchbox", { name: "Search project capabilities" }).fill(name);
			card = this.capabilityCard(name);
		}
		await card
			.getByText("Enabled", { exact: true })
			.or(card.getByRole("button", { name: "Configure", exact: true }))
			.waitFor();
	}

	async enableCapability(name: string) {
		await this.addCapability(name, false);
	}

	async enableCapabilityAfterReload(name: string) {
		await this.addCapability(name, true);
	}

	private async removeProjectCapability(name: string, reload: boolean) {
		let card = await this.openCapability(name);
		const removeResponse = this.waitForCapabilityMutation("DELETE");
		await card.getByRole("button", { name: "More actions" }).click();
		await this.page.getByRole("menuitem", { name: "Remove from project" }).click();
		const response = await removeResponse;
		if (!response.ok()) {
			throw new Error(
				`Capability removal failed with ${response.status()}: ${await response.text()}`,
			);
		}
		if (reload) {
			await this.reload();
			await this.page.getByRole("searchbox", { name: "Search project capabilities" }).fill(name);
			card = this.capabilityCard(name);
		}
		await card.getByRole("button", { name: "Add to project" }).waitFor();
	}

	async removeCapability(name: string) {
		await this.removeProjectCapability(name, false);
	}

	async removeCapabilityAfterReload(name: string) {
		await this.removeProjectCapability(name, true);
	}

	getCapabilityAddButton(name: string) {
		return this.capabilityCard(name).getByRole("button", { name: "Add to project" });
	}

	async configureMcpTool(label: string, serverUrl: string) {
		await this.openProjectSurface("Capabilities");
		await this.page.getByRole("searchbox", { name: "Search project capabilities" }).fill("MCP");
		const card = this.page
			.getByRole("heading", { name: "MCP", exact: true })
			.locator("xpath=ancestor::div[@data-slot='card'][1]");
		await card.getByRole("button", { name: "Configure" }).click();
		const dialog = this.page.getByRole("dialog", { name: "Configure MCP" });
		await dialog.getByLabel("Label", { exact: true }).fill(label);
		await dialog.getByLabel("Server URL", { exact: true }).fill(serverUrl);
		const saveResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				/\/projects\/[^/]+\/capabilities$/.test(response.url()),
		);
		await dialog.getByRole("button", { name: "Save configuration" }).click();
		const response = await saveResponse;
		if (!response.ok()) {
			throw new Error(
				`MCP configuration failed with ${response.status()}: ${await response.text()}`,
			);
		}
		await dialog.waitFor({ state: "hidden" });
		await card.getByText("Configured", { exact: true }).waitFor();
	}

	async configureFileSearchTool(vectorStoreIds: string[]) {
		await this.openProjectSurface("Capabilities");
		await this.page
			.getByRole("searchbox", { name: "Search project capabilities" })
			.fill("File search");
		const card = this.page
			.getByRole("heading", { name: "File search", exact: true })
			.locator("xpath=ancestor::div[@data-slot='card'][1]");
		await card.getByRole("button", { name: "Configure" }).click();
		const dialog = this.page.getByRole("dialog", { name: "Configure File search" });
		await dialog.getByLabel("Vector store IDs", { exact: true }).fill(vectorStoreIds.join("\n"));
		const saveResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				/\/projects\/[^/]+\/capabilities$/.test(response.url()),
		);
		await dialog.getByRole("button", { name: "Save configuration" }).click();
		const response = await saveResponse;
		if (!response.ok()) {
			throw new Error(
				`File search configuration failed with ${response.status()}: ${await response.text()}`,
			);
		}
		await dialog.waitFor({ state: "hidden" });
		await card.getByText("Configured", { exact: true }).waitFor();
	}

	private waitForRecipeInstallationMutation(method: "POST" | "PUT" | "DELETE") {
		return this.page.waitForResponse((response) => {
			if (response.request().method() !== method) return false;
			const pathname = new URL(response.url()).pathname;
			return method === "POST"
				? pathname.endsWith("/apps/recipes/daily-weather/install")
				: /\/apps\/recipes\/installations\/[^/]+$/.test(pathname);
		});
	}

	private async requireSuccessfulResponse(responsePromise: Promise<Response>, workflow: string) {
		const response = await responsePromise;
		if (!response.ok()) {
			throw new Error(`${workflow} failed with ${response.status()}: ${await response.text()}`);
		}
	}

	async configureScheduleAndRemoveDailyWeatherRecipe() {
		const recipeName = "Daily Weather";
		await this.enableCapabilityAfterReload(recipeName);
		let card = this.capabilityCard(recipeName);

		await card.getByRole("button", { name: "Configure", exact: true }).click();
		const configuration = this.page.getByRole("dialog", {
			name: `Configure ${recipeName}`,
		});
		await configuration.getByLabel("Location").fill("London, United Kingdom");
		await configuration.getByLabel("Forecast time").fill("Before the morning commute");
		await configuration.getByLabel("Units").fill("Celsius");
		const installResponse = this.waitForRecipeInstallationMutation("POST");
		await configuration.getByRole("button", { name: "Install recipe" }).click();
		await this.requireSuccessfulResponse(installResponse, "Recipe configuration");
		await configuration.waitFor({ state: "hidden" });
		await card.getByText("Configured", { exact: true }).waitFor();

		await card.getByRole("button", { name: "Schedule", exact: true }).click();
		const schedule = this.page.getByRole("dialog", { name: `Schedule ${recipeName}` });
		await schedule.getByLabel("Cron expression").fill("15 7 * * 1-5");
		await schedule
			.getByLabel("Prompt")
			.fill("Prepare the weekday release-validation forecast for London.");
		const scheduleResponse = this.waitForRecipeInstallationMutation("PUT");
		await schedule.getByRole("button", { name: "Schedule", exact: true }).click();
		await this.requireSuccessfulResponse(scheduleResponse, "Recipe scheduling");
		await schedule.waitFor({ state: "hidden" });

		await this.page.getByRole("link", { name: "Release Project", exact: true }).first().click();
		await this.page.getByRole("heading", { name: "Release Project", exact: true }).waitFor();
		const scheduleEntry = this.page.getByRole("listitem").filter({ hasText: recipeName });
		await scheduleEntry.getByText("15 7 * * 1-5 · active", { exact: false }).waitFor();

		await this.page.getByRole("button", { name: `View ${recipeName} configuration` }).click();
		const configurationSummary = this.page.getByRole("dialog", {
			name: `${recipeName} configuration`,
		});
		await configurationSummary.getByText("London, United Kingdom", { exact: true }).waitFor();
		await this.page.keyboard.press("Escape");
		await configurationSummary.waitFor({ state: "hidden" });

		await this.page.getByRole("button", { name: `Manage ${recipeName} schedule` }).click();
		const pauseResponse = this.waitForRecipeInstallationMutation("PUT");
		const pauseMenuItem = this.page.getByRole("menuitem", { name: "Pause schedule" });
		await pauseMenuItem.click();
		await this.requireSuccessfulResponse(pauseResponse, "Recipe schedule pause");
		await pauseMenuItem.waitFor({ state: "hidden" });
		await scheduleEntry.getByText("15 7 * * 1-5 · paused", { exact: false }).waitFor();
		await this.reload();
		await this.page.getByRole("heading", { name: "Release Project", exact: true }).waitFor();
		await scheduleEntry.getByText("15 7 * * 1-5 · paused", { exact: false }).waitFor();

		await this.page.getByRole("button", { name: `Manage ${recipeName} schedule` }).click();
		const resumeResponse = this.waitForRecipeInstallationMutation("PUT");
		const resumeMenuItem = this.page.getByRole("menuitem", { name: "Resume schedule" });
		await resumeMenuItem.click();
		await this.requireSuccessfulResponse(resumeResponse, "Recipe schedule resume");
		await resumeMenuItem.waitFor({ state: "hidden" });
		await scheduleEntry.getByText("15 7 * * 1-5 · active", { exact: false }).waitFor();
		await this.reload();
		await this.page.getByRole("heading", { name: "Release Project", exact: true }).waitFor();
		await scheduleEntry.getByText("15 7 * * 1-5 · active", { exact: false }).waitFor();

		await this.page.getByRole("button", { name: `Manage ${recipeName} schedule` }).click();
		await this.page.getByRole("menuitem", { name: "Edit schedule" }).click();
		await schedule.getByLabel("Cron expression").fill("30 8 * * 1-5");
		const editResponse = this.waitForRecipeInstallationMutation("PUT");
		await schedule.getByRole("button", { name: "Save schedule" }).click();
		await this.requireSuccessfulResponse(editResponse, "Recipe schedule update");
		await schedule.waitFor({ state: "hidden" });
		await scheduleEntry.getByText("30 8 * * 1-5 · active", { exact: false }).waitFor();

		await this.page.getByRole("button", { name: `Manage ${recipeName} schedule` }).click();
		await this.page.getByRole("menuitem", { name: "Stop schedule" }).click();
		const stopConfirmation = this.page.getByRole("dialog", { name: "Stop recipe schedule" });
		const stopResponse = this.waitForRecipeInstallationMutation("PUT");
		await stopConfirmation.getByRole("button", { name: "Stop schedule" }).click();
		await this.requireSuccessfulResponse(stopResponse, "Recipe schedule removal");
		await stopConfirmation.waitFor({ state: "hidden" });
		await scheduleEntry.waitFor({ state: "detached" });

		card = await this.openCapability(recipeName);
		await card.getByRole("button", { name: "Remove", exact: true }).click();
		const removeInstallationDialog = this.page.getByRole("dialog", { name: "Remove recipe" });
		const removeInstallationResponse = this.waitForRecipeInstallationMutation("DELETE");
		await removeInstallationDialog.getByRole("button", { name: "Remove", exact: true }).click();
		await this.requireSuccessfulResponse(removeInstallationResponse, "Recipe installation removal");
		await removeInstallationDialog.waitFor({ state: "hidden" });
		await card.getByRole("button", { name: "Configure", exact: true }).waitFor();

		const removeCapabilityResponse = this.waitForCapabilityMutation("DELETE");
		await card.getByRole("button", { name: "Recipe project actions" }).click();
		await this.page.getByRole("menuitem", { name: "Remove from project" }).click();
		const removedCapability = await removeCapabilityResponse;
		if (!removedCapability.ok()) {
			throw new Error(
				`Recipe capability removal failed with ${removedCapability.status()}: ${await removedCapability.text()}`,
			);
		}
		await this.reload();
		await this.page
			.getByRole("searchbox", { name: "Search project capabilities" })
			.fill(recipeName);
		await this.getCapabilityAddButton(recipeName).waitFor();
	}

	async createUpdateAndDeleteProjectNote(title: string, body: string) {
		await this.openProjectSurface("Experiences");
		await this.page.getByRole("link", { name: /Note Taker/ }).click();
		await this.page.getByRole("heading", { name: "Note Taker", exact: true }).waitFor();
		await this.page.getByRole("link", { name: "New note" }).click();

		const editor = this.page.getByPlaceholder("Start typing...");
		const createResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" && response.url().includes("/apps/notes"),
		);
		await editor.fill(`${title}\n${body}`);
		const created = await createResponse;
		if (!created.ok()) {
			throw new Error(
				`Project note creation failed with ${created.status()}: ${await created.text()}`,
			);
		}
		await this.page.getByText("All changes saved", { exact: true }).waitFor();

		const updateResponse = this.page.waitForResponse(
			(response) => response.request().method() === "PUT" && response.url().includes("/apps/notes"),
		);
		await editor.fill(`${title}\n${body}\nUpdated through release validation.`);
		const updated = await updateResponse;
		if (!updated.ok()) {
			throw new Error(
				`Project note update failed with ${updated.status()}: ${await updated.text()}`,
			);
		}

		await this.page.getByRole("button", { name: "Delete note" }).click();
		const confirmation = this.page.getByRole("dialog", { name: "Delete Note" });
		await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
		await confirmation.waitFor({ state: "hidden" });
		await this.page.getByRole("heading", { name: "No project notes" }).waitFor();
	}

	async createUpdateAndDeleteStrudelPattern(name: string, description: string) {
		await this.openProjectSurface("Experiences");
		await this.page.getByRole("link", { name: /Strudel Music Patterns/ }).click();
		await this.page.getByRole("heading", { name: "Strudel Music Patterns", exact: true }).waitFor();
		await this.page.getByRole("link", { name: "New pattern", exact: true }).click();
		await this.page.getByRole("button", { name: /Simple Drums/ }).click();
		await this.page.getByLabel("Name", { exact: true }).fill(name);
		await this.page.getByLabel("Description", { exact: true }).fill(description);
		await this.page.getByLabel(/Tags/).fill("release, validation");
		const createResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" && /\/apps\/strudel(?:\?|$)/.test(response.url()),
		);
		await this.page.getByRole("button", { name: "Save Pattern" }).click();
		const created = await createResponse;
		if (!created.ok()) {
			throw new Error(
				`Strudel pattern creation failed with ${created.status()}: ${await created.text()}`,
			);
		}
		await this.page.getByLabel("Name", { exact: true }).waitFor();

		await this.page.getByLabel("Description", { exact: true }).fill(`${description} Updated.`);
		const updateResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "PUT" && response.url().includes("/apps/strudel/"),
		);
		await this.page.getByRole("button", { name: "Save", exact: true }).click();
		const updated = await updateResponse;
		if (!updated.ok()) {
			throw new Error(
				`Strudel pattern update failed with ${updated.status()}: ${await updated.text()}`,
			);
		}

		const deleteResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "DELETE" && response.url().includes("/apps/strudel/"),
		);
		await this.page.getByRole("button", { name: "Delete pattern" }).click();
		const deleted = await deleteResponse;
		if (!deleted.ok()) {
			throw new Error(
				`Strudel pattern deletion failed with ${deleted.status()}: ${await deleted.text()}`,
			);
		}
		await this.page.getByRole("heading", { name: "No project patterns" }).waitFor();
	}

	async createArticleReportFromPastedContent(content: string) {
		await this.openProjectSurface("Experiences");
		await this.page.getByRole("link", { name: /Article Processor/ }).click();
		await this.page.getByRole("heading", { name: "Article Processor", exact: true }).waitFor();
		await this.page.getByRole("link", { name: "New report", exact: true }).click();
		await this.page.getByPlaceholder("Paste article content here...").fill(content);

		const analysisResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" && response.url().includes("/apps/articles/analyse"),
		);
		const summaryResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				response.url().includes("/apps/articles/summarise"),
		);
		const reportResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				response.url().includes("/apps/articles/generate-report"),
		);
		await this.page.getByRole("button", { name: "Process & Generate Report" }).click();
		for (const responsePromise of [analysisResponse, summaryResponse, reportResponse]) {
			const response = await responsePromise;
			if (!response.ok()) {
				throw new Error(
					`Article report workflow failed with ${response.status()}: ${await response.text()}`,
				);
			}
		}
		await this.page.getByRole("heading", { name: "Report Content", exact: true }).waitFor();
	}

	async uploadPodcastWithoutOptionalProcessing(title: string, description: string, audio: Buffer) {
		await this.openProjectSurface("Experiences");
		await this.page.getByRole("link", { name: /Podcast Processor/ }).click();
		await this.page.getByRole("heading", { name: "Podcast Processor", exact: true }).waitFor();
		await this.page.getByRole("link", { name: "New podcast", exact: true }).click();
		await this.page.getByLabel("Podcast Title *", { exact: true }).fill(title);
		await this.page.getByLabel("Description", { exact: true }).fill(description);
		await this.page.locator('input[type="file"]#audioFile').setInputFiles({
			name: "release-podcast.wav",
			mimeType: "audio/wav",
			buffer: audio,
		});
		const uploadResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" && response.url().includes("/apps/podcasts/upload"),
		);
		await this.page.getByRole("button", { name: "Upload & Continue" }).click();
		const response = await uploadResponse;
		if (!response.ok()) {
			throw new Error(`Podcast upload failed with ${response.status()}: ${await response.text()}`);
		}
		await this.page.getByRole("heading", { name: "Processing Options" }).waitFor();
		for (const option of ["Transcribe Podcast", "Generate Summary", "Generate Cover Image"]) {
			await this.page.getByLabel(option, { exact: true }).uncheck();
		}
		await this.page.getByRole("button", { name: "Process Podcast" }).click();
		await this.page.getByText(description, { exact: true }).waitFor();
		await this.page.getByRole("button", { name: "Transcribe podcast" }).waitFor();
	}

	async browseReplicateModelsAndPredictions(modelName: string) {
		await this.openProjectSurface("Experiences");
		await this.page.getByRole("link", { name: /Replicate Predictions/ }).click();
		await this.page.getByRole("heading", { name: "Replicate Predictions", exact: true }).waitFor();
		await this.page.getByPlaceholder("Search Replicate models...").fill(modelName);
		await this.page.getByRole("heading", { name: modelName, exact: true }).click();
		await this.page.getByRole("heading", { name: modelName, exact: true }).waitFor();
		await this.page.goBack();
		await this.page.getByRole("link", { name: /Replicate Predictions/ }).click();
		await this.page.getByPlaceholder("Search Replicate models...").waitFor();
		await this.page.getByRole("button", { name: "View my predictions" }).click();
		await this.page.getByRole("heading", { name: "No predictions yet" }).waitFor();
		await this.page.getByRole("link", { name: "Explore Models" }).click();
		await this.page.getByPlaceholder("Search Replicate models...").waitFor();
	}

	async browseTrainingDashboard() {
		await this.openProjectSurface("Experiences");
		await this.page
			.getByRole("heading", { name: "Training", exact: true })
			.locator("xpath=ancestor::a[1]")
			.click();
		await this.page.getByRole("heading", { name: "Training", exact: true }).waitFor();
		await this.page.getByRole("heading", { name: "No jobs yet" }).waitFor();
		await this.page.getByRole("tab", { name: "Deployments" }).click();
		await this.page.getByRole("heading", { name: "No deployments yet" }).waitFor();
		await this.page.getByRole("tab", { name: "Models" }).click();
		await this.page.getByText("Amazon Nova Lite", { exact: true }).waitFor();
	}

	async executeQrAppAndOpenSavedResponse(payload: string) {
		await this.openProjectSurface("Experiences");
		await this.page.getByRole("link", { name: /Create Qr Code/ }).click();
		await this.page.getByRole("heading", { name: "Create Qr Code", exact: true }).waitFor();
		await this.page.getByLabel(/^payload/).fill(payload);
		await this.page.getByLabel(/^size/).fill("240x240");
		const executionResponse = this.page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				response.url().includes("/dynamic-apps/create_qr_code/execute?projectId="),
		);
		await this.page.getByRole("button", { name: "Submit", exact: true }).click();
		const response = await executionResponse;
		if (!response.ok()) {
			throw new Error(
				`QR app execution failed with ${response.status()}: ${await response.text()}`,
			);
		}
		await this.page
			.getByRole("heading", { name: "Create Qr Code - Results", exact: true })
			.waitFor();

		await this.openProjectSurface("Experiences");
		await this.page.getByRole("link", { name: /Saved Dynamic App Responses/ }).click();
		await this.page.getByRole("link", { name: /App output: create_qr_code/ }).click();
		await this.page
			.getByRole("heading", { name: "App output: create_qr_code", exact: true })
			.waitFor();
		const json = this.page.locator('[data-responsetype="json"]');
		await json
			.getByRole("button", { name: /Object/ })
			.first()
			.click();
		await json
			.getByText("formData:", { exact: true })
			.locator("xpath=parent::div")
			.getByRole("button", { name: /Object/ })
			.click();
	}

	async shareAndRevokeOutput(title: string) {
		await this.openProjectSurface("Outputs");
		await this.page.getByRole("link", { name: new RegExp(title) }).click();
		await this.page.getByRole("heading", { name: title, exact: true }).waitFor();
		await this.page.getByRole("button", { name: "Share", exact: true }).click();
		await this.page.getByRole("button", { name: "Link copied", exact: true }).waitFor();
		await this.page.getByRole("heading", { name: "Active share links", exact: true }).waitFor();
		await this.page.getByRole("button", { name: "Revoke", exact: true }).click();
		await this.page.getByRole("heading", { name: "Active share links", exact: true }).waitFor({
			state: "detached",
		});
	}

	async openActivity() {
		await this.openProjectSurface("Activity");
		await this.page.getByText("Release validation run completed", { exact: true }).waitFor();
	}
}

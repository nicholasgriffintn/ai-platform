import { expect, test } from "../fixtures/polychat-test";

test.use({ persona: "pro" });

test("probe tasks panel", async ({ homePage, page, profilePage }) => {
  await homePage.navigate("/chat");
  await homePage.runBackgroundResponse("Complete this release task in the background");
  await profilePage.openTab("tasks", "Tasks");

  const panel = await page.locator("main").innerText();

  console.log("=== TASKS PANEL ===\n" + panel.slice(0, 1200));

  const api = await page.evaluate(async () => {
    const res = await fetch("http://localhost:8787/user/tasks", { credentials: "include" });

    return { status: res.status, body: (await res.text()).slice(0, 800) };
  });

  console.log("=== /user/tasks ===\n" + JSON.stringify(api, null, 1));
});

import { expect, test } from "../fixtures/polychat-test";

const OUT =
  "/private/tmp/claude-501/-Users-nicholasgriffin-workspace-assistant/a22f6499-4327-48de-9809-8cd24a097cd7/scratchpad/shots";

const WIDTHS = [1600, 1280, 1024, 860, 760, 660];

test.describe("composer audit", () => {
  test.use({ persona: "pro" });

  test("measures the model selector inside the project composer", async ({ page, workPage }) => {
    test.setTimeout(180_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    await workPage.openNewProjectConversation();

    const shell = page.locator("[data-chat-input-shell]:visible").first();
    const trigger = page.getByRole("button", { name: "Select a model", exact: true }).first();

    await expect(trigger).toBeVisible();

    const report: Record<string, unknown> = {};

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);
      await shell.screenshot({ path: `${OUT}/composer-${width}.png` });
      report[`w${width}`] = await trigger.evaluate((el) => {
        const button = el.getBoundingClientRect();
        const wrapper = el.closest("div.relative")?.parentElement;
        const wrapperRect = wrapper?.getBoundingClientRect();
        const next = wrapper?.nextElementSibling?.getBoundingClientRect();
        const footer = wrapper?.parentElement?.getBoundingClientRect();

        return {
          button: { x: Math.round(button.x), w: Math.round(button.width) },
          wrapper: wrapperRect
            ? { x: Math.round(wrapperRect.x), w: Math.round(wrapperRect.width) }
            : null,
          next: next ? { x: Math.round(next.x), w: Math.round(next.width) } : null,
          footer: footer ? { x: Math.round(footer.x), w: Math.round(footer.width) } : null,
          overlapsNext: next ? Math.round(button.right - next.left) : null,
          escapesWrapper: wrapperRect ? Math.round(button.right - wrapperRect.right) : null,
        };
      });
    }

    await page.setViewportSize({ width: 860, height: 900 });
    await page.waitForTimeout(300);
    await trigger.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/composer-open-860.png` });
    const panel = page.getByRole("dialog", { name: "Model selection dialog", exact: true });

    report.panelOpen860 = {
      panel: await panel.boundingBox(),
      shell: await shell.boundingBox(),
    };

    console.log(`COMPOSER_REPORT ${JSON.stringify(report, null, 2)}`);
  });
});

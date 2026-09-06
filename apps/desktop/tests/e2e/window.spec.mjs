import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";

import { remote } from "webdriverio";

const DRIVER_PORT = 4444;
const APPLICATION = process.env.POLYCHAT_DESKTOP_BINARY;

let driver;
let browser;

async function waitForDriver() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DRIVER_PORT}/status`);

      if (response.ok) {
        return;
      }
    } catch {
      void 0;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("tauri-driver did not start");
}

describe("the packaged window", { skip: !APPLICATION }, () => {
  before(async () => {
    driver = spawn("tauri-driver", ["--port", String(DRIVER_PORT)], { stdio: "inherit" });
    await waitForDriver();
    browser = await remote({
      port: DRIVER_PORT,
      capabilities: { "tauri:options": { application: APPLICATION }, browserName: "wry" },
      logLevel: "error",
    });
  });

  after(async () => {
    await browser?.deleteSession();
    driver?.kill();
  });

  it("renders the packaged renderer rather than an empty window", async () => {
    await browser.waitUntil(async () => (await browser.$("main").getText()).trim().length > 0, {
      timeout: 15_000,
      timeoutMsg: "the window never rendered any content",
    });
  });

  it("gates on sign-in with a control the packaged build can actually work", async () => {
    const signIn = await browser.$("main button");

    await signIn.waitForDisplayed({
      timeout: 15_000,
      timeoutMsg: "the welcome screen never offered a sign-in control",
    });

    assert.ok(await signIn.isEnabled(), "expected the sign-in control to be interactive");
  });

  it("refuses to reach a runtime directly from the window", async () => {
    const reached = await browser.execute(async () => {
      try {
        await fetch("http://127.0.0.1:11434/api/tags");

        return true;
      } catch {
        return false;
      }
    });

    assert.equal(reached, false, "the content security policy should block direct egress");
  });
});

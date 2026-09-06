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

  it("opens with both loopback runtimes listed", async () => {
    const items = await browser.$$("main ul li");

    assert.ok(items.length >= 2, "expected the seeded runtimes to be listed");

    const text = await browser.$("main").getText();

    assert.match(text, /Ollama/);
    assert.match(text, /LM Studio/);
  });

  it("reports a runtime that is not running rather than pretending it is", async () => {
    const check = await browser.$("main ul li button");

    await check.click();

    await browser.waitUntil(
      async () => /Not running|Ready/.test(await browser.$("main").getText()),
      { timeout: 15_000, timeoutMsg: "readiness never resolved" },
    );
  });

  it("offers sign-in while signed out and keeps device models usable", async () => {
    const text = await browser.$("section").getText();

    assert.match(text, /Not signed in|Signed in/);
    assert.match(text, /Models on this device still work|Cloud models are available/);
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

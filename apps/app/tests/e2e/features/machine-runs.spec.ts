import { machineRunSnapshotSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, provisionPersonaSession, test } from "../fixtures/polychat-test";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Machine execution authority and lifecycle", () => {
  test.use({ persona: "pro" });

  test("claims once, rejects forged updates and preserves cancellation", async ({
    page,
    browser,
  }, testInfo) => {
    const machineId = crypto.randomUUID();
    const path = `${E2E_API_BASE_URL}/machines/${machineId}/runs`;
    const headers = { origin: E2E_APP_BASE_URL };
    const heartbeat = await page.request.post(`${E2E_API_BASE_URL}/machines/heartbeat`, {
      headers,
      data: {
        machineId,
        label: "Execution lifecycle",
        platform: "linux",
        appVersion: "0.1.0",
        capabilities: ["model-relay"],
        runtimes: [
          {
            kind: "model",
            vendor: "ollama",
            readiness: { status: "ready", version: "test", checkedAt: new Date().toISOString() },
            models: [
              {
                nativeId: "test-model",
                displayName: "Test model",
                contextTokens: null,
                capabilities: { tools: false, vision: false, thinking: false },
                loaded: false,
              },
            ],
          },
        ],
      },
    });

    expect(heartbeat.ok(), await heartbeat.text()).toBe(true);
    const id = crypto.randomUUID();
    const data = {
      id,
      vendor: "ollama",
      nativeModelId: "test-model",
      conversationId: crypto.randomUUID(),
      messages: [{ role: "user", content: "Hello" }],
    };

    expect((await page.request.post(path, { headers, data })).status()).toBe(409);
    expect((await page.request.post(`${path}/claim`, { headers })).ok()).toBe(true);
    expect((await page.request.post(path, { headers, data })).ok()).toBe(true);
    const claimResponse = await page.request.post(`${path}/claim`, { headers });
    const claim = await claimResponse.json();

    expect(claim.request.id).toBe(id);
    const outsider = await provisionPersonaSession(
      "pro",
      `${testInfo.testId}:outsider:${testInfo.retry}`,
    );
    const outsiderContext = await browser.newContext();

    try {
      await outsiderContext.addCookies([
        {
          name: "session",
          value: outsider.sessionToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);
      expect((await outsiderContext.request.get(`${path}/${id}`)).status()).toBe(404);
      expect((await outsiderContext.request.post(`${path}/claim`, { headers })).status()).toBe(404);
      expect(
        (await outsiderContext.request.post(`${path}/${id}/cancel`, { headers })).status(),
      ).toBe(404);
    } finally {
      await outsiderContext.close();
    }

    expect(await (await page.request.post(`${path}/claim`, { headers })).json()).toBeNull();
    const update = {
      id,
      token: crypto.randomUUID(),
      sequence: 0,
      text: "Wrong owner",
      state: "running",
    };

    expect((await page.request.post(`${path}/update`, { headers, data: update })).status()).toBe(
      404,
    );
    const accepted = await page.request.post(`${path}/update`, {
      headers,
      data: { ...update, token: claim.token, text: "Partial" },
    });

    expect(machineRunSnapshotSchema.parse(await accepted.json()).text).toBe("Partial");
    const duplicate = await page.request.post(`${path}/update`, {
      headers,
      data: { ...update, token: claim.token, text: "Partial" },
    });

    expect(machineRunSnapshotSchema.parse(await duplicate.json()).text).toBe("Partial");
    const cancelled = await page.request.post(`${path}/${id}/cancel`, { headers });

    expect(machineRunSnapshotSchema.parse(await cancelled.json()).state).toBe("cancelled");
    const late = await page.request.post(`${path}/update`, {
      headers,
      data: { ...update, token: claim.token, sequence: 1, state: "completed", text: "Late result" },
    });

    expect(machineRunSnapshotSchema.parse(await late.json())).toMatchObject({
      state: "cancelled",
      text: "Partial",
    });
    for (let index = 0; index < 21; index += 1) {
      const nextId = crypto.randomUUID();

      await page.request.post(`${path}/claim`, { headers });
      const created = await page.request.post(path, { headers, data: { ...data, id: nextId } });

      expect(created.ok(), await created.text()).toBe(true);
      const nextClaim = await (await page.request.post(`${path}/claim`, { headers })).json();
      const completed = await page.request.post(`${path}/update`, {
        headers,
        data: {
          id: nextId,
          token: nextClaim.token,
          sequence: 0,
          state: "completed",
          text: "Finished",
        },
      });

      expect(machineRunSnapshotSchema.parse(await completed.json()).state).toBe("completed");
    }

    expect((await page.request.get(`${path}/${id}`)).status()).toBe(404);
    await page.request.delete(`${E2E_API_BASE_URL}/machines/${machineId}`, { headers });
    expect((await page.request.get(`${path}/${id}`)).status()).toBe(404);
  });
});

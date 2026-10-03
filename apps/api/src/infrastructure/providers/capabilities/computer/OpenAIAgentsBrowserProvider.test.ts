import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAIAgentsClient } from "~/infrastructure/providers/agents/OpenAIAgentsClient";
import { browserTestApproval } from "~/test-utils/computer-use";

import { OpenAIAgentsBrowserProvider } from "./OpenAIAgentsBrowserProvider";

const provider = new OpenAIAgentsBrowserProvider(new OpenAIAgentsClient("test-openai-key"));

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI managed computer session protocol", () => {
  it("creates a recoverable browser task with restricted networking", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({ id: "session", status: "idle" }));

    vi.stubGlobal("fetch", fetch);
    await expect(
      provider.create({
        model: "gpt-6-astra",
        task: "Read issues",
        referenceId: "browser-local",
        allowedDomains: ["example.test"],
      }),
    ).resolves.toBe("session");
    const [url, options] = fetch.mock.calls[0];

    expect(url).toBe("https://api.openai.com/v1/agents/sessions");
    expect(new Headers(options?.headers).get("OpenAI-Beta")).toBe("agents=v1");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      metadata: { polychat_browser_session_id: "browser-local" },
      input: [{ role: "user", content: [{ type: "input_text", text: "Read issues" }] }],
      agent: { tools: [{ type: "computer_use", include_screenshots: true }] },
      environment: {
        desktop: { enabled: true },
        network: { access: "restricted", allowed_domains: ["example.test"] },
      },
    });
  });
  it("reads current root-turn results through paginated session items", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/turns")) {
        return Response.json({
          data: [
            { id: "child-turn", status: "completed", subagent_id: "child" },
            { id: "turn-root", status: "completed", subagent_id: null },
          ],
        });
      }

      if (url.pathname.endsWith("/items")) {
        if (!url.searchParams.has("after")) {
          return Response.json({
            data: [
              {
                type: "computer_use_call",
                id: "activity",
                turn_id: "turn-root",
                title: "Reading issues",
                status: "completed",
                output: { type: "computer_screenshot", image_url: "data:image/jpeg;base64,YQ==" },
              },
              {
                type: "message",
                turn_id: "old-turn",
                role: "assistant",
                phase: "final_answer",
                content: [{ type: "output_text", text: "Old result" }],
              },
            ],
            has_more: true,
            last_id: "activity",
          });
        }

        expect(url.searchParams.get("after")).toBe("activity");

        return Response.json({
          data: [
            {
              type: "message",
              turn_id: "turn-root",
              role: "assistant",
              phase: "final_answer",
              content: [{ type: "output_text", text: "Found three issues" }],
            },
          ],
          has_more: false,
          last_id: "answer",
        });
      }

      return Response.json({ id: "session", status: "idle", required_actions: [] });
    });

    vi.stubGlobal("fetch", fetch);
    await expect(provider.inspect("session")).resolves.toMatchObject({
      status: "completed",
      turnId: "turn-root",
      outputText: "Found three issues",
      activity: [{ screenshot: "data:image/jpeg;base64,YQ==" }],
    });
  });
  it("builds approvals from the current required actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async (input) => {
        if (String(input).includes("/turns?")) {
          return Response.json({
            data: [{ id: "turn-root", status: "waiting", subagent_id: null }],
          });
        }

        if (String(input).includes("/items?")) {
          return Response.json({ data: [], has_more: false, last_id: null });
        }

        return Response.json({
          id: "session",
          status: "requires_action",
          required_actions: [
            {
              type: "computer_use_approval_request",
              request_id: browserTestApproval.requestId,
              turn_id: browserTestApproval.turnId,
              request: browserTestApproval.request,
            },
          ],
        });
      }),
    );
    await expect(provider.inspect("session")).resolves.toMatchObject({
      status: "requires_action",
      approvals: [browserTestApproval],
    });
  });
  it("submits sign-in only as a dedicated event, without replaying failures or reflecting secrets", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        Response.json({ error: "reflected-sensitive-value" }, { status: 500 }),
      );

    vi.stubGlobal("fetch", fetch);
    const input = {
      requestId: "request",
      response: {
        type: "browser_authentication" as const,
        action: "submit" as const,
        fields: [{ field_id: "password", value: "sensitive-value" }],
      },
    };

    await provider.respond("session", input);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Idempotency-Key")).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      events: [
        {
          type: "agent.session.input.computer_use_approval_request_result",
          request_id: "request",
          response: input.response,
        },
      ],
    });
    await expect(provider.respond("session", input)).rejects.toThrow(
      "OpenAI Agents request failed (500)",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("recovers the existing session by metadata across pages", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: "other", status: "idle" }],
          has_more: true,
          last_id: "other",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [
            {
              id: "original",
              status: "in_progress",
              metadata: { polychat_browser_session_id: "browser-local" },
            },
          ],
          has_more: false,
          last_id: "original",
        }),
      );

    vi.stubGlobal("fetch", fetch);
    await expect(provider.recover("browser-local")).resolves.toBe("original");
    expect(String(fetch.mock.calls[1][0])).toContain("after=other");
  });
});

import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Miniflare } from "miniflare";

const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(runtimeDirectory, "../../../../../");
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "polychat-e2e-"));
const buildDirectory = path.join(temporaryDirectory, "api");
const trainingBuildDirectory = path.join(temporaryDirectory, "training");
const compatibilityDate = "2026-08-08";
const serverEncryptionKeyBytes = Buffer.alloc(32, 7);
const composioAccounts = new Map();
const stripeSecretKey = "sk_test_polychat_e2e";
const stripeProPriceId = "price_e2e_pro";
const stripeProOveragePriceId = "price_e2e_pro_overage";
const apiPort = Number(process.env.POLYCHAT_E2E_API_PORT ?? "8787");
const appPort = Number(process.env.POLYCHAT_E2E_APP_PORT ?? "5173");
const apiBaseUrl = `http://localhost:${apiPort}`;
const appBaseUrl = `http://localhost:${appPort}`;

const E2E_PLANS = [
  {
    id: "anonymous",
    name: "Signed out",
    description: "Demo allowance for visitors who have not signed in",
    price: 0,
    includedCredits: null,
    graceCredits: null,
    stripePriceId: null,
    stripeMeterId: null,
    overagePriceId: null,
  },
  {
    id: "free",
    name: "Free",
    description: "Default plan for signed in accounts",
    price: 0,
    includedCredits: null,
    graceCredits: null,
    stripePriceId: null,
    stripeMeterId: null,
    overagePriceId: null,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Frontier models, generation, live voice, sandboxed runs and Work",
    price: 8,
    includedCredits: null,
    graceCredits: null,
    stripePriceId: stripeProPriceId,
    stripeMeterId: "mtr_e2e_pro",
    overagePriceId: stripeProOveragePriceId,
  },
];
const composioAuthConfig = {
  id: "ac_XI46beTJeNlJ",
  name: "airtable",
  toolkit: { slug: "airtable" },
  auth_scheme: "OAUTH2",
  is_composio_managed: true,
  status: "ENABLED",
  restrict_to_following_tools: [],
};

const mockAiWorker = `
import { RpcTarget, WorkerEntrypoint } from "cloudflare:workers";

class Gateway extends RpcTarget {
  getUrl() {
    return "https://e2e-provider.invalid/v1";
  }

	patchLog() {
		return undefined;
	}
}

export class MockAi extends WorkerEntrypoint {
  gateway() {
    return new Gateway();
  }

  async toMarkdown(files) {
    return files.map((file) => ({
      format: "markdown",
      name: file.name,
      data: "# " + file.name + "\\n\\nConverted by the E2E Cloudflare boundary double.",
    }));
  }

	async run(model, body) {
		if (
			body?.response_format?.json_schema?.name === "prompt_requirements" ||
			body?.messages?.some(
				(message) =>
					typeof message?.content === "string" && message.content.includes('"expectedComplexity"'),
			)
		) {
			return {
				response: JSON.stringify({
					expectedComplexity: 2,
					requiredStrengths: [],
					criticalStrengths: [],
					estimatedInputTokens: 32,
					estimatedOutputTokens: 64,
					needsFunctions: false,
					benefitsFromMultipleModels: false,
					modelComparisonReason: "",
				}),
			};
		}
		if (String(model).includes("bge-large-en-v1.5")) {
			return { data: [[0.25, 0.5, 0.75, 1]] };
		}
		if (String(model).includes("llava")) {
			return { description: "E2E release validation sketch" };
		}
		if (String(model).includes("stable-diffusion")) {
			return Uint8Array.from([
				137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
				0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218,
				99, 100, 248, 15, 0, 1, 5, 1, 1, 39, 24, 227, 102, 0, 0, 0, 0, 73, 69, 78,
				68, 174, 66, 96, 130,
			]).buffer;
		}
    const content = body?.messages?.at(-1)?.content;
    const prompt = typeof content === "string" ? content : JSON.stringify(content ?? "");
    if (body?.stream) {
      const chunks = [
        { response: "E2E response: " + prompt },
        {
          response: "",
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
        },
      ];
      const streamBody =
        chunks.map((chunk) => "data: " + JSON.stringify(chunk) + "\\n\\n").join("") +
        "data: [DONE]\\n\\n";
      return new Response(streamBody, {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      }).body;
    }
    return {
      response: "E2E response: " + prompt,
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    };
  }
}

export class MockEmail extends WorkerEntrypoint {
  async send() {
    return undefined;
  }
}

export default {
  fetch() {
    return new Response("AI test service only supports RPC", { status: 405 });
  },
};
`;

function extractPrompt(body) {
  const content = body.messages?.at(-1)?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text")
      .map((part) => part.text ?? "")
      .join(" ");
  }

  return (body.contents?.at(-1)?.parts ?? [])
    .map((part) => part?.text ?? "")
    .filter(Boolean)
    .join(" ");
}

function openAiResponse(content) {
  return {
    id: "e2e-completion",
    object: "chat.completion",
    created: 0,
    model: "e2e-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
  };
}

function openAiToolCallResponse(toolCall) {
  return {
    id: "e2e-completion",
    object: "chat.completion",
    created: 0,
    model: "e2e-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: null, tool_calls: [toolCall] },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
  };
}

function toolCallStreamingResponse(toolCall) {
  const chunks = [
    {
      id: "e2e-completion",
      object: "chat.completion.chunk",
      created: 0,
      model: "e2e-model",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", tool_calls: [{ index: 0, ...toolCall }] },
          finish_reason: null,
        },
      ],
    },
    {
      id: "e2e-completion",
      object: "chat.completion.chunk",
      created: 0,
      model: "e2e-model",
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    },
  ];
  const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;

  return new Response(body, {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

/**
 * Deterministic tool calls for journeys that exercise tool-driven UI. The marker phrase keeps the
 * provider mock free of model behaviour: a test asks for the tool by name in its prompt.
 */
const TOOL_CALL_TRIGGERS = [
  {
    marker: "Convene a council on",
    name: "select_council_members",
    arguments: () =>
      JSON.stringify({
        question: "Which release validation approach is safest?",
        recommended: ["sceptic", "architect"],
        reason: "These two disagree most about release risk.",
      }),
  },
];

function resolveToolCallTrigger(prompt) {
  const trigger = TOOL_CALL_TRIGGERS.find((candidate) => prompt.includes(candidate.marker));

  if (!trigger) {
    return null;
  }

  return {
    id: `e2e-tool-call-${trigger.name}`,
    type: "function",
    function: { name: trigger.name, arguments: trigger.arguments() },
  };
}

function streamingResponse(content, delayedContent, delayMs = 2_500) {
  const contentChunks = [content, ...(delayedContent ? [delayedContent] : [])];
  const chunks = [
    ...contentChunks.map((chunk) => ({
      id: "e2e-completion",
      object: "chat.completion.chunk",
      created: 0,
      model: "e2e-model",
      choices: [{ index: 0, delta: { role: "assistant", content: chunk }, finish_reason: null }],
    })),
    {
      id: "e2e-completion",
      object: "chat.completion.chunk",
      created: 0,
      model: "e2e-model",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    },
  ];

  if (!delayedContent) {
    const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;

    return new Response(body, {
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    });
  }

  let index = 0;
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async pull(controller) {
      if (index === 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (index < chunks.length) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunks[index])}\n\n`));
        index += 1;

        return;
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

function openAiResponsesStreamingResponse(content) {
  const response = {
    id: "e2e-responses-completion",
    object: "response",
    status: "completed",
    model: "e2e-model",
    output: [
      {
        id: "e2e-responses-message",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: content, annotations: [] }],
      },
    ],
  };
  const events = [
    {
      type: "response.output_text.delta",
      delta: content,
      item_id: "e2e-responses-message",
      output_index: 0,
      content_index: 0,
    },
    { type: "response.completed", response },
  ];
  const stream = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

function googleStreamingResponse(content) {
  const chunk = {
    candidates: [
      {
        content: { role: "model", parts: [{ text: content }] },
        finishReason: "STOP",
      },
    ],
    usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 4, totalTokenCount: 12 },
  };

  return new Response(`data: ${JSON.stringify(chunk)}\n\n`, {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

async function mockComposioRequest(request, url) {
  const pathname = url.pathname.replace(/^\/api\/v3\.1/, "");

  if (request.method === "GET" && pathname === "/connected_accounts") {
    const filters = [
      ["user_ids", "user_id"],
      ["toolkit_slugs", "toolkit.slug"],
      ["auth_config_ids", "auth_config.id"],
      ["connected_account_ids", "id"],
    ];
    const readField = (account, path) =>
      path.split(".").reduce((value, key) => value?.[key], account);
    const items = [...composioAccounts.values()].filter((account) =>
      filters.every(([parameter, field]) => {
        const expected = url.searchParams.get(parameter)?.split(",").filter(Boolean);

        return !expected?.length || expected.includes(readField(account, field));
      }),
    );

    return Response.json({ items });
  }

  if (
    request.method === "GET" &&
    pathname === `/auth_configs/${encodeURIComponent(composioAuthConfig.id)}`
  ) {
    return Response.json(composioAuthConfig);
  }

  if (request.method === "POST" && pathname === "/connected_accounts/link") {
    const body = await request.json();
    const accountId = `ca_e2e_${String(body.user_id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const timestamp = "2026-08-14T00:00:00.000Z";

    composioAccounts.set(accountId, {
      id: accountId,
      user_id: body.user_id,
      toolkit: { slug: "airtable" },
      auth_config: { id: composioAuthConfig.id },
      status: "ACTIVE",
      created_at: timestamp,
      updated_at: timestamp,
      is_disabled: false,
    });

    return Response.json({
      id: accountId,
      redirect_url: `https://connect.composio.dev/link/e2e?connected_account_id=${encodeURIComponent(accountId)}`,
    });
  }

  const accountMatch = pathname.match(/^\/connected_accounts\/([^/]+)(\/revoke)?$/);

  if (accountMatch && request.method === "POST" && accountMatch[2] === "/revoke") {
    return Response.json({ success: true });
  }

  if (accountMatch && request.method === "DELETE" && !accountMatch[2]) {
    composioAccounts.delete(decodeURIComponent(accountMatch[1]));

    return Response.json({ success: true });
  }

  throw new Error(`Unexpected Composio request during E2E: ${request.method} ${pathname}`);
}

function mockStripeSubscription(subscriptionId) {
  const periodEnd = Math.floor(Date.UTC(2099, 0, 1) / 1000);

  return {
    id: subscriptionId,
    object: "subscription",
    status: "active",
    currency: "gbp",
    customer: "cus_e2e_pro",
    cancel_at: null,
    cancel_at_period_end: false,
    days_until_due: null,
    trial_end: null,
    items: {
      object: "list",
      has_more: false,
      url: `/v1/subscription_items?subscription=${subscriptionId}`,
      data: [
        {
          id: "si_e2e_pro",
          object: "subscription_item",
          subscription: subscriptionId,
          current_period_start: Math.floor(Date.UTC(2099, 0, 1) / 1000) - 2_592_000,
          current_period_end: periodEnd,
          price: {
            id: stripeProPriceId,
            object: "price",
            active: true,
            currency: "gbp",
            unit_amount: 800,
            recurring: { interval: "month", interval_count: 1 },
          },
        },
      ],
    },
  };
}

async function mockStripeRequest(request, url) {
  const subscriptionMatch = /^\/v1\/subscriptions\/([^/]+)$/.exec(url.pathname);

  if (request.method === "GET" && subscriptionMatch) {
    return Response.json(mockStripeSubscription(decodeURIComponent(subscriptionMatch[1])));
  }

  if (request.method === "POST" && url.pathname === "/v1/customers") {
    return Response.json({ id: "cus_e2e_checkout", object: "customer" });
  }

  if (request.method === "POST" && url.pathname === "/v1/checkout/sessions") {
    const form = await request.formData();

    if (
      form.get("allow_promotion_codes") !== "true" ||
      form.get("line_items[0][price]") !== stripeProPriceId ||
      form.get("line_items[0][quantity]") !== "1"
    ) {
      throw new Error("Stripe Checkout request is missing promotion codes or the Pro Price");
    }

    return Response.json({
      id: "cs_e2e_pro",
      object: "checkout.session",
      url: "https://checkout.stripe.com/c/pay/cs_e2e_pro",
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/billing_portal/sessions") {
    const form = await request.formData();

    if (form.get("return_url") !== `${appBaseUrl}/profile?tab=billing`) {
      throw new Error("Stripe portal request did not preserve the allowed return URL");
    }

    return Response.json({
      id: "bps_e2e_pro",
      object: "billing_portal.session",
      url: "https://billing.stripe.com/p/session/bps_e2e_pro",
    });
  }

  throw new Error(`Unexpected Stripe request during E2E: ${request.method} ${url.pathname}`);
}

async function mockExternalRequest(request) {
  const url = new URL(request.url);

  if (url.hostname === "backend.composio.dev") {
    return mockComposioRequest(request, url);
  }

  if (url.hostname === "api.stripe.com") {
    return mockStripeRequest(request, url);
  }

  if (
    request.method === "POST" &&
    url.hostname === "generativelanguage.googleapis.com" &&
    url.pathname === "/v1beta/auth_tokens"
  ) {
    const tokenRequest = await request.clone().json();

    if (tokenRequest.liveConnectConstraints?.model !== "models/gemini-3.1-flash-live-preview") {
      throw new Error("Gemini Live token request is missing the constrained model");
    }

    return Response.json({
      name: "e2e-gemini-live-token",
      expireTime: "2099-01-01T00:00:00.000Z",
      newSessionExpireTime: "2099-01-01T00:00:00.000Z",
    });
  }

  if (request.method === "GET" && url.hostname === "media.e2e.invalid") {
    const isVideo = url.pathname.endsWith(".mp4");

    return new Response(
      isVideo
        ? Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50])
        : Uint8Array.from([
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8,
            4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 100, 248, 15, 0,
            1, 5, 1, 1, 39, 24, 227, 102, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
          ]),
      { headers: { "content-type": isVideo ? "video/mp4" : "image/png" } },
    );
  }

  if (url.hostname !== "e2e-provider.invalid") {
    throw new Error(
      `Unexpected external request during E2E: ${request.method} ${url.origin}${url.pathname}`,
    );
  }

  if (request.method === "GET" && /\/responses\/[^/]+$/.test(url.pathname)) {
    return Response.json({
      id: url.pathname.split("/").at(-1),
      object: "response",
      status: "completed",
      background: true,
      model: "gpt-5.2",
      output_text: "E2E background response completed",
      output: [
        {
          id: "e2e-background-message",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "E2E background response completed",
              annotations: [],
            },
          ],
        },
      ],
    });
  }

  const body = await request.json();

  if (
    body?.response_format?.json_schema?.name === "prompt_requirements" ||
    body?.messages?.some(
      (message) =>
        typeof message?.content === "string" && message.content.includes('"expectedComplexity"'),
    )
  ) {
    return Response.json(
      openAiResponse(
        JSON.stringify({
          expectedComplexity: 2,
          requiredStrengths: [],
          criticalStrengths: [],
          estimatedInputTokens: 32,
          estimatedOutputTokens: 64,
          needsFunctions: false,
          benefitsFromMultipleModels: false,
          modelComparisonReason: "",
        }),
      ),
    );
  }

  if (request.method === "POST" && url.pathname.endsWith("/v1/predictions")) {
    const isVideo = body.version === "bytedance/seedance-2.0";

    return Response.json({
      id: "e2e-replicate-prediction",
      status: "succeeded",
      output: [
        isVideo
          ? "https://media.e2e.invalid/release-validation.mp4"
          : "https://media.e2e.invalid/release-validation.png",
      ],
      input: body.input,
    });
  }

  if (request.method === "POST" && url.pathname.endsWith("/responses")) {
    if (
      body.model === "gpt-6-astra" &&
      ["temperature", "top_p", "top_logprobs"].some((field) => field in body)
    ) {
      throw new Error("GPT-6 Astra received an unsupported sampling or logprobs field");
    }

    if (body.background === true) {
      return Response.json({
        id: "e2e-background-response",
        object: "response",
        status: "queued",
        background: true,
        model: body.model,
        output: [],
      });
    }

    const responseText = `E2E response: ${JSON.stringify(body.input ?? "")}`;

    if (body.stream === true) {
      return openAiResponsesStreamingResponse(responseText);
    }

    return Response.json({
      id: "e2e-responses-completion",
      object: "response",
      status: "completed",
      model: body.model,
      output_text: responseText,
      output: [
        {
          id: "e2e-responses-message",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: responseText, annotations: [] }],
        },
      ],
    });
  }

  const prompt = extractPrompt(body);

  if (prompt.includes("Trigger an error")) {
    return Response.json({ error: { message: "Deterministic provider failure" } }, { status: 503 });
  }

  const toolCall = resolveToolCallTrigger(prompt);

  if (toolCall) {
    return body.stream
      ? toolCallStreamingResponse(toolCall)
      : Response.json(openAiToolCallResponse(toolCall));
  }

  const content = prompt.includes("You are a title generator")
    ? "Release validation chat"
    : `E2E response: ${prompt}`;

  if (url.pathname.includes("v1beta/models/")) {
    return url.pathname.includes("streamGenerateContent")
      ? googleStreamingResponse(content)
      : Response.json({
          candidates: [{ content: { role: "model", parts: [{ text: content }] } }],
          usageMetadata: {
            promptTokenCount: 8,
            candidatesTokenCount: 4,
            totalTokenCount: 12,
          },
        });
  }

  if (body.stream && prompt.includes("Recover this interrupted stream")) {
    return streamingResponse(
      "E2E response: recovery data so far",
      " and the interrupted stream completed",
      2_500,
    );
  }

  return body.stream ? streamingResponse(content) : Response.json(openAiResponse(content));
}

function buildWorkerBundle(workspace, configPath, outputDirectory) {
  execFileSync(
    "pnpm",
    [
      "--filter",
      workspace,
      "exec",
      "wrangler",
      "deploy",
      "--dry-run",
      "--config",
      configPath,
      "--outdir",
      outputDirectory,
    ],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: path.join(temporaryDirectory, "wrangler.log"),
      },
    },
  );

  const outputNames = readdirSync(outputDirectory);
  const bundleName = outputNames.find((name) => name.endsWith(".js"));

  if (!bundleName) {
    throw new Error(`Wrangler did not produce a bundle for ${workspace}`);
  }

  return {
    script: readFileSync(path.join(outputDirectory, bundleName), "utf8"),
    textModules: outputNames
      .filter((name) => name.endsWith(".md") && name !== "README.md")
      .map((name) => ({
        type: "Text",
        path: name,
        contents: readFileSync(path.join(outputDirectory, name), "utf8"),
      })),
  };
}

function createRuntimeOptions(apiBundle, trainingBundle, port, seedMaterial) {
  const readinessSessionHash = createHash("sha256")
    .update("polychat-e2e-pro-0")
    .digest("base64url");
  const unavailableOptionalModule = (packageName) => `
		throw new Error("Optional package ${packageName} is not available in the Polychat E2E Worker");
		export const JSONSchema = undefined;
		export const toJsonSchema = undefined;
		export const toJSONSchema = undefined;
	`;
  const apiEntryModule = `
		import api, { ConversationCoordinator, SandboxRunCoordinator } from "./api.js";

		export { ConversationCoordinator, SandboxRunCoordinator };

	function withExternalBindingShape(env) {
			const ai = env.AI;
			return {
				...env,
				AI: {
					aiGatewayLogId: "e2e-gateway-log-id",
					gateway: (...args) => ai.gateway(...args),
					run: (...args) => ai.run(...args),
					toMarkdown: async (files) => files.map((file) => ({
						format: "markdown",
						name: file.name,
						mimeType: file.blob?.type || "application/octet-stream",
						data: "# " + file.name + "\\n\\nConverted by the E2E Cloudflare boundary double.",
					})),
				},
				VECTOR_DB: {
					deleteByIds: async () => undefined,
					query: async () => ({
						count: 1,
						matches: [{ id: "e2e-vector-match", metadata: { type: "source" }, score: 0.99 }],
					}),
					upsert: async (vectors) => ({ count: vectors.length, ids: vectors.map(({ id }) => id) }),
				},
			};
		}

		export default {
			fetch(request, env, context) {
				return api.fetch(request, withExternalBindingShape(env), context);
			},
			scheduled(event, env, context) {
				return api.scheduled?.(event, withExternalBindingShape(env), context);
			},
			queue(batch, env, context) {
				return api.queue?.(batch, withExternalBindingShape(env), context);
			},
		};
	`;

  return {
    host: "127.0.0.1",
    port,
    workers: [
      {
        name: "api",
        modules: [
          { type: "ESModule", path: "e2e-entry.js", contents: apiEntryModule },
          { type: "ESModule", path: "api.js", contents: apiBundle.script },
          ...apiBundle.textModules,
          {
            type: "ESModule",
            path: "effect",
            contents: unavailableOptionalModule("effect"),
          },
          {
            type: "ESModule",
            path: "@valibot/to-json-schema",
            contents: unavailableOptionalModule("@valibot/to-json-schema"),
          },
          {
            type: "ESModule",
            path: "sury",
            contents: unavailableOptionalModule("sury"),
          },
        ],
        compatibilityDate,
        compatibilityFlags: [
          "nodejs_compat",
          "nodejs_compat_populate_process_env",
          "service_binding_extra_handlers",
        ],
        bindings: {
          ACCOUNT_ID: "e2e-account",
          AI_GATEWAY_TOKEN: "e2e-gateway-token",
          ALWAYS_ENABLED_PROVIDERS: "google-ai-studio,groq,mistral,openai,replicate,workers-ai",
          API_BASE_URL: apiBaseUrl,
          APP_BASE_URL: appBaseUrl,
          COMPOSIO_USER_NAMESPACE: "e2e",
          COMPOSIO_API_KEY: "e2e-composio-api-key",
          ENV: "development",
          GROQ_API_KEY: "e2e-groq-key",
          GOOGLE_STUDIO_API_KEY: "e2e-google-key",
          GITHUB_CLIENT_ID: "e2e-github-client",
          GITHUB_CLIENT_SECRET: "e2e-github-secret",
          JWT_SECRET: "polychat-e2e-jwt-secret-at-least-thirty-two-characters",
          LOG_LEVEL: "error",
          MEMORY_SYNTHESIS_ENABLED: "false",
          MISTRAL_API_KEY: "e2e-mistral-key",
          OPENAI_API_KEY: "e2e-openai-key",
          PRIVATE_KEY: serverEncryptionKeyBytes.toString("base64"),
          REPLICATE_API_TOKEN: "e2e-replicate-token",
          SES_EMAIL_FROM: "e2e@polychat.invalid",
          STRIPE_SECRET_KEY: stripeSecretKey,
          TRAINING_WORKER_TOKEN: "polychat-e2e-training-worker-token",
        },
        d1Databases: { DB: "polychat-e2e" },
        kvNamespaces: ["CACHE"],
        r2Buckets: ["ASSETS_BUCKET", "PRIVATE_ASSETS_BUCKET"],
        queueProducers: {
          TASK_QUEUE: { queueName: "polychat-task-queue" },
        },
        queueConsumers: {
          "polychat-task-queue": {
            maxBatchSize: 10,
            maxBatchTimeout: 0.1,
            maxRetries: 0,
            deadLetterQueue: "polychat-task-queue-dlq",
          },
        },
        ratelimits: {
          FREE_RATE_LIMITER: {
            namespace_id: "e2e-free",
            simple: { limit: 10_000, period: 60 },
          },
          PRO_RATE_LIMITER: {
            namespace_id: "e2e-pro",
            simple: { limit: 10_000, period: 60 },
          },
        },
        durableObjects: {
          CONVERSATION_COORDINATOR: {
            className: "ConversationCoordinator",
            useSQLite: true,
          },
          SANDBOX_RUN_COORDINATOR: {
            className: "SandboxRunCoordinator",
            useSQLite: true,
          },
        },
        serviceBindings: {
          AI: { name: "external-services", entrypoint: "MockAi" },
          SEND_EMAIL: { name: "external-services", entrypoint: "MockEmail" },
          TRAINING_WORKER: { name: "training" },
        },
        outboundService: mockExternalRequest,
      },
      {
        name: "training",
        modules: [
          {
            type: "ESModule",
            path: "training.js",
            contents: trainingBundle.script,
          },
          ...trainingBundle.textModules,
        ],
        compatibilityDate,
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          TRAINING_WORKER_TOKEN: "polychat-e2e-training-worker-token",
          LOG_LEVEL: "error",
        },
        d1Databases: { DB: "polychat-e2e" },
      },
      {
        name: "external-services",
        modules: true,
        script: mockAiWorker,
        compatibilityDate,
        compatibilityFlags: ["service_binding_extra_handlers"],
      },
      {
        name: "readiness",
        modules: true,
        script: `
					const publicJwk = ${JSON.stringify(seedMaterial.publicJwk)};
					const storedPrivateKey = ${JSON.stringify(seedMaterial.storedPrivateKey)};
					const expiresAt = "2099-01-01T00:00:00.000Z";

					async function hashSession(sessionToken) {
						const digest = await crypto.subtle.digest(
							"SHA-256",
							new TextEncoder().encode(sessionToken),
						);
						let binary = "";
						for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
						return btoa(binary)
							.replaceAll("+", "-")
							.replaceAll("/", "_")
							.replace(/=+$/u, "");
					}

					function userIdFor(identity) {
						return Number.parseInt(identity.slice(0, 12), 16);
					}

					const PERSONA_ALLOWANCE = {
						anonymous: { included: 15, grace: 7.5 },
						free: { included: 150, grace: 50 },
						pro: { included: 1500, grace: 150 },
					};

					function creditMicros(credits) {
						return Math.round((typeof credits === "number" ? credits : 0) * 1000000);
					}

					function currentUsagePeriod() {
						return new Date().toISOString().slice(0, 7);
					}

					function ledgerStatements(env, identity, userId, period, ledger) {
						return ledger.map((entry, index) =>
							env.DB.prepare(
								"INSERT INTO usage_event (id, idempotency_key, user_id, occurred_at, period, source, vendor, resource, unit, quantity, cost_micros, credit_micros, billable, byok, estimated, project_id, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)"
							).bind(
								"e2e-usage-event-" + identity + "-" + index,
								"e2e-usage-key-" + identity + "-" + index,
								userId,
								new Date(Date.now() - index * 60000).toISOString(),
								period,
								entry.source,
								entry.vendor,
								entry.resource,
								entry.unit,
								entry.quantity,
								Math.round(entry.costMicros || 0),
								creditMicros(entry.credits),
								entry.source === "model" && entry.byok ? 0 : 1,
								entry.byok ? 1 : 0,
								entry.projectId || null,
								entry.workspaceId || null,
							),
						);
					}

					function accountBillingStatements(env, identity, userId, persona, billing) {
						const period = billing.period || currentUsagePeriod();
						const allowance = PERSONA_ALLOWANCE[persona];
						const ledger = Array.isArray(billing.ledger) ? billing.ledger : [];
						const statements = [
							env.DB.prepare("DELETE FROM usage_event WHERE user_id = ?").bind(userId),
							env.DB.prepare("DELETE FROM usage_balance WHERE user_id = ?").bind(userId),
							env.DB.prepare(
								"INSERT INTO usage_balance (id, user_id, period, plan_id, included_credit_micros, grace_credit_micros, spent_credit_micros, reserved_credit_micros, overrun_credit_micros, overage_credit_micros, overage_enabled, last_event_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
							).bind(
								"e2e-balance-" + identity,
								userId,
								period,
								persona,
								creditMicros(allowance.included),
								creditMicros(allowance.grace),
								creditMicros(billing.spentCredits),
								creditMicros(billing.reservedCredits),
								creditMicros(billing.overrunCredits),
								creditMicros(billing.overageCredits),
								billing.overageEnabled ? 1 : 0,
								ledger.length > 0 ? new Date().toISOString() : null,
							),
							...ledgerStatements(env, identity, userId, period, ledger),
						];

						statements.push(
							env.DB.prepare(
								"UPDATE user SET stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
							).bind(
								billing.subscribed ? "cus_e2e_" + identity.slice(0, 16) : null,
								billing.subscribed ? "sub_e2e_" + identity.slice(0, 16) : null,
								userId,
							),
						);

						return statements;
					}

	async function provisionPersona(request, env) {
		const { identity, persona, sessionToken, billing } = await request.json();
		if (
			typeof identity !== "string" ||
			!/^[a-f0-9]{64}$/.test(identity) ||
			(persona !== "logged-out" && persona !== "free" && persona !== "pro") ||
			(persona !== "logged-out" && typeof sessionToken !== "string") ||
			(billing !== undefined && billing !== null && typeof billing !== "object")
		) {
			return Response.json({ error: "Invalid persona setup request" }, { status: 400 });
		}
		const billingState = billing || {};
		if (persona === "logged-out") {
			const anonymousId = identity.slice(0, 36);
			await env.DB.prepare(
				"INSERT OR IGNORE INTO anonymous_user (id, ip_address, user_agent) VALUES (?, ?, 'Playwright')"
			).bind(anonymousId, identity).run();
			await env.DB.prepare(
				"UPDATE anonymous_user SET credit_period = ?, spent_credit_micros = ?, reserved_credit_micros = ? WHERE id = ?"
			).bind(
				billingState.period || currentUsagePeriod(),
				creditMicros(billingState.spentCredits),
				creditMicros(billingState.reservedCredits),
				anonymousId,
			).run();
			return new Response(null, { status: 204 });
		}

		const userId = userIdFor(identity);
						const userName = persona === "pro" ? "Pro Release User" : "Free Release User";
						const email = persona + "-" + identity + "@e2e.polychat.invalid";
						const sessionId = await hashSession(sessionToken);
						const workspaceId = "e2e-workspace-" + identity;
						const projectId = "e2e-project-" + identity;

						const statements = [
							env.DB.prepare(
								"INSERT OR IGNORE INTO user (id, name, email, plan_id, setup_at, terms_accepted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
							).bind(userId, userName, email, persona),
							env.DB.prepare(
								"INSERT OR IGNORE INTO session (id, user_id, expires_at) VALUES (?, ?, ?)"
							).bind(sessionId, userId, expiresAt),
							env.DB.prepare(
								"INSERT OR IGNORE INTO user_settings (id, user_id, nickname, public_key, private_key) VALUES (?, ?, ?, ?, ?)"
							).bind("e2e-settings-" + identity, userId, userName, publicJwk, storedPrivateKey),
							env.DB.prepare(
								"INSERT OR IGNORE INTO provider_settings (id, provider_id, user_id, enabled) VALUES (?, 'openai', ?, 0)"
							).bind("e2e-provider-" + identity, userId),
						];

						if (persona === "pro") {
							statements.push(
								env.DB.prepare(
									"INSERT OR IGNORE INTO workspace (id, name, description, created_by) VALUES (?, 'Release Workspace', 'Release validation workspace', ?)"
								).bind(workspaceId, userId),
								env.DB.prepare(
									"INSERT OR IGNORE INTO workspace_member (workspace_id, user_id, role) VALUES (?, ?, 'owner')"
								).bind(workspaceId, userId),
								env.DB.prepare(
									"INSERT OR IGNORE INTO project (id, workspace_id, name, description, instructions, created_by) VALUES (?, ?, 'Release Project', 'Release validation project', 'Use concise answers.', ?)"
								).bind(projectId, workspaceId, userId),
								env.DB.prepare(
									"INSERT OR IGNORE INTO output (id, created_by_user_id, project_id, capability_id, kind, title, status, sensitivity, content) VALUES (?, ?, ?, 'release-validation', 'report', 'Release validation output', 'ready', 'internal', ?)"
								).bind(
									"e2e-output-" + identity,
									userId,
									projectId,
									JSON.stringify({ summary: "Release output content", status: "ready" }),
								),
								env.DB.prepare(
									"INSERT OR IGNORE INTO activity_record (id, created_by_user_id, project_id, capability_id, kind, status, summary, data) VALUES (?, ?, ?, 'release-validation', 'run', 'completed', 'Release validation run completed', '{}')"
								).bind("e2e-activity-" + identity, userId, projectId),
							);
						}

						statements.push(
							...accountBillingStatements(env, identity, userId, persona, billingState),
						);

						await env.DB.batch(statements);
						return new Response(null, { status: 204 });
					}

					async function readAnonymousState(request, env) {
						const cookie = request.headers.get("cookie") || "";
						const anonymousId = cookie.match(/(?:^|;\\s*)anon_id=([^;]+)/)?.[1];
						const completionId = new URL(request.url).searchParams.get("completion_id");
						if (!anonymousId || !completionId) {
							return Response.json({ error: "Missing anonymous state key" }, { status: 400 });
						}
						const state = await env.DB.prepare(
							"SELECT credit_period, spent_credit_micros, reserved_credit_micros FROM anonymous_user WHERE id = ?"
						).bind(decodeURIComponent(anonymousId)).first();
						const ledger = await env.DB.prepare(
							"SELECT COUNT(*) AS event_count FROM usage_event WHERE conversation_id = ?"
						).bind(completionId).first();

						return Response.json({ ...state, event_count: Number(ledger?.event_count || 0) });
					}

					export default {
						async fetch(request, env) {
							try {
								const url = new URL(request.url);
								if (request.method === "POST" && url.pathname === "/__e2e-persona") {
									return provisionPersona(request, env);
								}
								if (request.method === "GET" && url.pathname === "/__e2e-persona-state") {
									return readAnonymousState(request, env);
								}
								const session = await env.DB.prepare(
									"SELECT user_id FROM session WHERE id = ?"
								).bind("${readinessSessionHash}").first();
								return new Response(null, { status: session?.user_id === 93000 ? 204 : 503 });
							} catch {
								return new Response(null, { status: 503 });
							}
						},
					};
				`,
        compatibilityDate,
        d1Databases: { DB: "polychat-e2e" },
        routes: [
          `${apiBaseUrl}/__e2e-ready`,
          `${apiBaseUrl}/__e2e-persona`,
          `${apiBaseUrl}/__e2e-persona-state*`,
        ],
      },
    ],
  };
}

async function applyMigrations(database) {
  const migrationsDirectory = path.join(repositoryRoot, "apps/api/migrations");
  const migrations = readdirSync(migrationsDirectory)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && !name.startsWith("9"))
    .sort();

  for (const migration of migrations) {
    const statements = readFileSync(path.join(migrationsDirectory, migration), "utf8")
      .replaceAll("--> statement-breakpoint", "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await database.prepare(statement).run();
    }
  }
}

async function createPersonaSeedMaterial() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
  const publicJwk = JSON.stringify(publicKey.export({ format: "jwk" }));
  const privateJwk = privateKey.export({ format: "jwk" });
  const serverEncryptionKey = await crypto.subtle.importKey(
    "raw",
    serverEncryptionKeyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const privateKeyIv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivateKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: privateKeyIv },
    serverEncryptionKey,
    new TextEncoder().encode(JSON.stringify(privateJwk)),
  );
  const storedPrivateKey = JSON.stringify({
    iv: Buffer.from(privateKeyIv).toString("base64"),
    data: Buffer.from(encryptedPrivateKey).toString("base64"),
  });

  return { publicJwk, storedPrivateKey };
}

async function seedPersonas(database, seedMaterial) {
  const { publicJwk, storedPrivateKey } = seedMaterial;
  const expiresAt = "2099-01-01T00:00:00.000Z";

  for (const plan of E2E_PLANS) {
    await database
      .prepare(
        "INSERT INTO plans (id, name, description, price, included_credits, grace_credits, stripe_price_id, stripe_meter_id, overage_price_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, description = excluded.description, price = excluded.price, included_credits = excluded.included_credits, grace_credits = excluded.grace_credits, stripe_price_id = excluded.stripe_price_id, stripe_meter_id = excluded.stripe_meter_id, overage_price_id = excluded.overage_price_id",
      )
      .bind(
        plan.id,
        plan.name,
        plan.description,
        plan.price,
        plan.includedCredits,
        plan.graceCredits,
        plan.stripePriceId,
        plan.stripeMeterId,
        plan.overagePriceId,
      )
      .run();
  }

  for (const address of ["unknown", "127.0.0.1", "::1", "::ffff:127.0.0.1", "0.0.0.0"]) {
    const anonymousIp = createHash("sha256").update(address).digest("hex");

    await database
      .prepare(
        "INSERT OR IGNORE INTO anonymous_user (id, ip_address, user_agent) VALUES (?, ?, 'Playwright')",
      )
      .bind(anonymousIp.slice(0, 36), anonymousIp)
      .run();
  }

  for (let index = 0; index < 1; index += 1) {
    for (const persona of ["free", "pro"]) {
      const userId = (persona === "free" ? 92000 : 93000) + index;
      const rawSession = `polychat-e2e-${persona}-${index}`;
      const sessionId = createHash("sha256").update(rawSession).digest("base64url");
      const email = `${persona}-${index}@e2e.polychat.invalid`;
      const name = persona === "pro" ? "Pro Release User" : "Free Release User";

      await database
        .prepare(
          "INSERT INTO user (id, name, email, plan_id, setup_at, terms_accepted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(userId, name, email, persona)
        .run();
      await database
        .prepare("INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(sessionId, userId, expiresAt)
        .run();
      await database
        .prepare(
          "INSERT INTO user_settings (id, user_id, nickname, public_key, private_key) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(`e2e-settings-${persona}-${index}`, userId, name, publicJwk, storedPrivateKey)
        .run();
      await database
        .prepare(
          "INSERT INTO provider_settings (id, provider_id, user_id, enabled) VALUES (?, 'openai', ?, 0)",
        )
        .bind(`e2e-provider-${persona}-${index}`, userId)
        .run();

      if (persona === "pro") {
        const workspaceId = `e2e-workspace-${index}`;
        const projectId = `e2e-project-${index}`;

        await database
          .prepare(
            "INSERT INTO workspace (id, name, description, created_by) VALUES (?, 'Release Workspace', 'Release validation workspace', ?)",
          )
          .bind(workspaceId, userId)
          .run();
        await database
          .prepare(
            "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES (?, ?, 'owner')",
          )
          .bind(workspaceId, userId)
          .run();
        await database
          .prepare(
            "INSERT INTO project (id, workspace_id, name, description, instructions, created_by) VALUES (?, ?, 'Release Project', 'Release validation project', 'Use concise answers.', ?)",
          )
          .bind(projectId, workspaceId, userId)
          .run();
        await database
          .prepare(
            "INSERT INTO output (id, created_by_user_id, project_id, capability_id, kind, title, status, sensitivity, content) VALUES (?, ?, ?, 'release-validation', 'report', 'Release validation output', 'ready', 'internal', ?)",
          )
          .bind(
            `e2e-output-${index}`,
            userId,
            projectId,
            JSON.stringify({ summary: "Release output content", status: "ready" }),
          )
          .run();
        await database
          .prepare(
            "INSERT INTO activity_record (id, created_by_user_id, project_id, capability_id, kind, status, summary, data) VALUES (?, ?, ?, 'release-validation', 'run', 'completed', 'Release validation run completed', '{}')",
          )
          .bind(`e2e-activity-${index}`, userId, projectId)
          .run();

        if (index === 0) {
          const token = "polychat-e2e-shared-output-release-token-0001";

          await database
            .prepare(
              "INSERT INTO conversation (id, user_id, title, is_public, share_id, message_count) VALUES ('e2e-public-conversation', ?, 'Public release conversation', 1, 'polychat-e2e-shared-conversation-release-0001', 2)",
            )
            .bind(userId)
            .run();
          await database
            .prepare(
              "INSERT INTO message (id, conversation_id, role, content, model, status, platform) VALUES ('e2e-public-message-user', 'e2e-public-conversation', 'user', 'Can this release be shared?', NULL, 'complete', 'web')",
            )
            .run();
          await database
            .prepare(
              "INSERT INTO message (id, conversation_id, role, content, model, status, platform) VALUES ('e2e-public-message-assistant', 'e2e-public-conversation', 'assistant', 'Shared release conversation response', 'e2e-model', 'complete', 'web')",
            )
            .run();
          await database
            .prepare(
              "INSERT INTO output (id, created_by_user_id, project_id, capability_id, kind, title, status, sensitivity, content) VALUES ('e2e-public-output', ?, ?, 'release-validation', 'report', 'Public release output', 'ready', 'internal', ?)",
            )
            .bind(userId, projectId, JSON.stringify("Public release output content"))
            .run();
          await database
            .prepare(
              "INSERT INTO output_share (id, output_id, token_hash, created_by_user_id) VALUES ('e2e-output-share-0', 'e2e-public-output', ?, ?)",
            )
            .bind(createHash("sha256").update(token).digest("hex"), userId)
            .run();
        }
      }
    }
  }
}

let runtime;

async function start() {
  const apiBundle = buildWorkerBundle(
    "@assistant/api",
    path.join(runtimeDirectory, "wrangler.jsonc"),
    buildDirectory,
  );
  const trainingBundle = buildWorkerBundle(
    "@assistant/training",
    path.join(runtimeDirectory, "training-wrangler.jsonc"),
    trainingBuildDirectory,
  );
  const seedMaterial = await createPersonaSeedMaterial();

  runtime = new Miniflare(createRuntimeOptions(apiBundle, trainingBundle, apiPort, seedMaterial));
  await runtime.ready;
  const database = await runtime.getD1Database("DB", "api");

  await applyMigrations(database);
  await seedPersonas(database, seedMaterial);
  console.log(`Polychat E2E API ready at ${apiBaseUrl}`);
}

async function stop(exitCode = 0) {
  try {
    await runtime?.dispose();
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    process.exit(exitCode);
  }
}

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());

start().catch((error) => {
  console.error(error);
  void stop(1);
});

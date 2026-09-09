import { MACHINE_ID, OWNER } from "./identity.mjs";
import {
  ahead,
  at,
  insert,
  seedId,
  SEED_MODEL,
  SEED_MODEL_SMALL,
  sha256Hex,
  SILENT_AUDIO_DATA_URL,
  svgDataUrl,
} from "./sql.mjs";
import { buildThread, toolCall } from "./thread.mjs";

const USAGE = { prompt_tokens: 812, completion_tokens: 344, total_tokens: 1156, cost_usd: 0.0021 };

export const SCENARIOS = [];

function scenario(tag, title, tryThis, expect) {
  SCENARIOS.push({ tag, title, tryThis, expect });

  return `[${tag}] ${title}`;
}

function contextSnapshot(conversationId, overrides = {}) {
  return {
    protocolVersion: 1,
    runId: `${conversationId}-run`,
    conversationId,
    attempt: 1,
    step: 1,
    model: SEED_MODEL,
    provider: "workers-ai",
    generatedAt: at({ hours: 1 }),
    usage: { inputTokens: 2310, contextWindow: 128000, source: "reported" },
    messages: { included: 4, omitted: 0 },
    sources: [],
    skills: [],
    approvals: [],
    summary: null,
    omissions: [],
    ...overrides,
  };
}

function thread(statements, options, messages) {
  const built = buildThread({ userId: OWNER.id, ...options }, messages);

  statements.push(...built.statements);

  return built;
}

export function chatStatements({ teammates }) {
  const statements = [];
  const conversationIds = {};

  const plain = thread(
    statements,
    {
      id: seedId("chat", "plain"),
      title: scenario(
        "Chat",
        "Plan a week of dinners",
        "Open the chat and send a follow-up such as 'Swap Thursday for something vegetarian'. Watch the reply stream in, then edit your first message and regenerate.",
        "Markdown renders with headings, a table and a checklist. The conversation list updates its preview and timestamp.",
      ),
      createdAt: at({ days: 6, hours: 3 }),
      pinned: true,
    },
    [
      {
        role: "user",
        content:
          "Plan a week of dinners for two. We eat fish twice a week, no red meat, and Wednesday needs to be under twenty minutes.",
      },
      {
        role: "assistant",
        usage: USAGE,
        content: `Here is a week that keeps fish to Tuesday and Friday and gives Wednesday a fast turnaround.

| Day | Dinner | Time |
| --- | --- | --- |
| Monday | Chickpea and spinach curry with rice | 35 min |
| Tuesday | Baked cod with lemon, capers and new potatoes | 30 min |
| Wednesday | Halloumi wraps with quick pickled onions | 15 min |
| Thursday | Mushroom and leek risotto | 40 min |
| Friday | Salmon traybake with fennel and orange | 30 min |
| Saturday | Homemade pizza night | 60 min |
| Sunday | Roast squash, sage and hazelnut pasta | 45 min |

**Shopping notes**

- [ ] Cod and salmon can both be bought frozen. Defrost Tuesday's fish on Monday night.
- [ ] Buy two blocks of halloumi. Wednesday only needs one, Saturday's pizza can use the other.
- [ ] Arborio rice, dried porcini and a lemon cover the risotto and the cod.

Tell me if you want a shopping list grouped by aisle.`,
      },
      { role: "user", content: "Yes, group it by aisle and keep it short." },
      {
        role: "assistant",
        usage: USAGE,
        content: `**Produce**: spinach, new potatoes, lemon, red onion, leek, mushrooms, fennel, orange, butternut squash, sage, basil.

**Chilled**: halloumi (2), parmesan, mozzarella, butter.

**Fish**: cod fillets (2), salmon fillets (2).

**Cupboard**: chickpeas, tinned tomatoes, coconut milk, arborio rice, dried porcini, capers, hazelnuts, pasta, flour, yeast, passata.

That is 24 items. Nothing on the list is used only once except the hazelnuts, which you could skip.`,
      },
    ],
  );

  conversationIds.plain = plain.conversationId;

  thread(
    statements,
    {
      id: seedId("chat", "reasoning"),
      title: scenario(
        "Reasoning",
        "How many piano tuners are in London",
        "Expand the reasoning block above the answer. Send another Fermi question to see a fresh reasoning trace stream before the answer.",
        "A collapsible reasoning section renders above the reply with token usage in the footer.",
      ),
      createdAt: at({ days: 5, hours: 8 }),
      run: { status: "succeeded" },
    },
    [
      { role: "user", content: "Roughly how many piano tuners work in London? Show your working." },
      {
        role: "assistant",
        usage: { ...USAGE, completion_tokens: 610, total_tokens: 1422 },
        parts: [
          {
            type: "reasoning",
            text: "Population of Greater London is about 9 million. Assume 2.4 people per household gives 3.75 million households. Perhaps 1 in 25 has a piano, so 150,000 pianos. A piano is tuned about once a year. A tuner does 3 tunings a day, 5 days a week, 48 weeks a year, so 720 per year. 150,000 / 720 is roughly 210. Round to a range because the piano ownership guess dominates the error.",
            collapsed: true,
          },
          {
            type: "text",
            text: "Somewhere between **150 and 300**, with 200 as the central estimate.\n\n- 9 million people, about 3.75 million households\n- 1 in 25 households owns a piano, so roughly 150,000 pianos\n- One tuning a year each, and a tuner manages about 720 a year\n- 150,000 divided by 720 gives about 210\n\nThe piano ownership guess is the weak link. Halve it and you get around 100 tuners, double it and you get 400.",
          },
        ],
        content:
          "Somewhere between **150 and 300**, with 200 as the central estimate. The piano ownership guess is the weak link.",
      },
    ],
  );

  const tools = thread(
    statements,
    {
      id: seedId("chat", "tools"),
      title: scenario(
        "Tools",
        "Weather and web search",
        "Ask 'What is the weather in Lisbon this weekend and what is on there?'. Expand each tool card to see arguments and results.",
        "Two tool cards render (weather and web search) followed by an answer with citations under it.",
      ),
      createdAt: at({ days: 4, hours: 2 }),
      run: {
        status: "succeeded",
        contextJson: contextSnapshot(seedId("chat", "tools"), {
          skills: [{ id: "weather", name: "Weather", state: "loaded" }],
        }),
      },
    },
    [
      {
        role: "user",
        content: "What is the weather like in Lisbon this weekend, and is anything on?",
      },
      ...toolCall({
        name: "get_weather",
        callId: "call_weather_1",
        input: { location: "Lisbon, Portugal", units: "metric" },
        result: {
          location: "Lisbon",
          forecast: [
            { day: "Saturday", high: 27, low: 18, condition: "Sunny", precipitation: 0 },
            { day: "Sunday", high: 25, low: 17, condition: "Partly cloudy", precipitation: 10 },
          ],
        },
        data: {
          responseType: "custom",
          renderer: "weather",
          icon: "cloud-sun",
          formattedName: "Weather",
          data: {
            location: "Lisbon",
            forecast: [
              { day: "Saturday", high: 27, low: 18, condition: "Sunny", precipitation: 0 },
              { day: "Sunday", high: 25, low: 17, condition: "Partly cloudy", precipitation: 10 },
            ],
          },
        },
      }),
      ...toolCall({
        name: "web_search",
        callId: "call_search_1",
        input: { query: "Lisbon events this weekend" },
        result: {
          results: [
            {
              title: "Lisbon Jazz Fest returns to Belém",
              url: "https://example.com/lisbon-jazz-fest",
              snippet: "Free outdoor concerts on Saturday evening at Jardim de Belém.",
            },
            {
              title: "Feira da Ladra flea market",
              url: "https://example.com/feira-da-ladra",
              snippet: "The Tuesday and Saturday market in Alfama runs from 9am.",
            },
          ],
        },
        data: {
          responseType: "custom",
          renderer: "web_search",
          icon: "search",
          formattedName: "Web search",
          data: {
            query: "Lisbon events this weekend",
            results: [
              {
                title: "Lisbon Jazz Fest returns to Belém",
                url: "https://example.com/lisbon-jazz-fest",
                snippet: "Free outdoor concerts on Saturday evening at Jardim de Belém.",
              },
              {
                title: "Feira da Ladra flea market",
                url: "https://example.com/feira-da-ladra",
                snippet: "The Tuesday and Saturday market in Alfama runs from 9am.",
              },
            ],
          },
        },
      }),
      {
        role: "assistant",
        usage: USAGE,
        citations: ["https://example.com/lisbon-jazz-fest", "https://example.com/feira-da-ladra"],
        content: `Warm and dry. Saturday is sunny with a high of 27°C, Sunday is a touch cooler at 25°C with a small chance of a shower.

Two things worth planning around:

- **Lisbon Jazz Fest** has free outdoor concerts in Belém on Saturday evening.
- **Feira da Ladra** runs Saturday morning in Alfama from 9am, so go early before the heat.

Pack a light layer for Sunday evening, the low is 17°C.`,
      },
    ],
  );

  conversationIds.tools = tools.conversationId;

  thread(
    statements,
    {
      id: seedId("chat", "artifact"),
      title: scenario(
        "Artifacts",
        "Build a pomodoro timer",
        "Open the artifact panel from the reply, then ask 'Add a long break every four sessions' and watch the artifact update in place.",
        "A panel artifact (React component) opens on the right and an inline SVG artifact renders in the thread.",
      ),
      createdAt: at({ days: 3, hours: 6 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content:
          "Build me a small pomodoro timer component in React with a 25 minute work block and a 5 minute break.",
      },
      {
        role: "assistant",
        usage: USAGE,
        content: `Here is a self-contained component. It keeps state in the component, so drop it anywhere.

<artifact identifier="pomodoro-timer" type="application/code" language="tsx" title="Pomodoro timer" display="panel">
import { useEffect, useState } from "react";

const WORK = 25 * 60;
const BREAK = 5 * 60;

export function PomodoroTimer() {
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [remaining, setRemaining] = useState(WORK);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRemaining((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (remaining > 0) return;
    setPhase((current) => (current === "work" ? "break" : "work"));
    setRemaining(phase === "work" ? BREAK : WORK);
  }, [remaining, phase]);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div style={{ fontFamily: "system-ui", textAlign: "center", padding: 24 }}>
      <p style={{ textTransform: "uppercase", letterSpacing: 2 }}>{phase}</p>
      <p style={{ fontSize: 64, margin: 0 }}>{minutes}:{seconds}</p>
      <button onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start"}</button>
    </div>
  );
}
</artifact>

And a small badge you can reuse in the header:

<artifact identifier="pomodoro-badge" type="image/svg+xml" title="Pomodoro badge" display="inline">
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect rx="8" width="120" height="40" fill="#E8643C"/><text x="60" y="25" fill="#fff" font-family="sans-serif" font-size="14" text-anchor="middle">25 / 5</text></svg>
</artifact>

The break length is a constant so a long break every four sessions is a two line change.`,
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "quote"),
      title: scenario(
        "Quote",
        "Refine a paragraph",
        "Select a few words in the assistant reply and press Quote, then send a comment about the selection. Try the same on an artifact.",
        "The quoted selection renders as a card on the user message with the source message linked.",
      ),
      createdAt: at({ days: 3, hours: 1 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content:
          "Rewrite this for a product changelog: We are thrilled to finally unveil scheduled runs, a game changing way to automate your workflow.",
      },
      {
        role: "assistant",
        usage: USAGE,
        content:
          "Scheduled runs are live. Pick a time, choose a teammate, and the run starts without you at the keyboard. Runs show in Attention when they need a decision.",
      },
      {
        role: "user",
        content: [
          {
            type: "selection",
            selection: {
              source: {
                kind: "message",
                messageId: `${seedId("chat", "quote")}-m2`,
                role: "assistant",
                runId: `${seedId("chat", "quote")}-run`,
              },
              selectedText: "without you at the keyboard",
              comment: "Too casual for the changelog, make it plainer.",
            },
          },
          { type: "text", text: "Tighten this bit." },
        ],
      },
      {
        role: "assistant",
        usage: USAGE,
        content:
          "Scheduled runs are live. Pick a time and a teammate, and the run starts unattended. Runs appear in Attention when they need a decision.",
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "grounding"),
      title: scenario(
        "Search grounding",
        "Latest on WebGPU support",
        "Hover the grounding chips under the reply and open a source. Ask a follow-up about Safari to see grounding refresh.",
        "Grounded search chips and citations render under the assistant message.",
      ),
      createdAt: at({ days: 2, hours: 20 }),
      modelId: "gemini-3-pro",
      run: {
        status: "succeeded",
        provenance: { site: "hosted", vendor: "google-ai-studio", model: "gemini-3-pro" },
      },
    },
    [
      { role: "user", content: "What is the current state of WebGPU support across browsers?" },
      {
        role: "assistant",
        model: "gemini-3-pro",
        provenance: { site: "hosted", vendor: "google-ai-studio", model: "gemini-3-pro" },
        usage: USAGE,
        citations: ["https://example.com/webgpu-status", "https://example.com/caniuse-webgpu"],
        data: {
          searchGrounding: {
            searchEntryPoint: {
              renderedContent: "<div>Search results for WebGPU browser support</div>",
            },
            groundingChunks: [
              {
                web: {
                  uri: "https://example.com/webgpu-status",
                  title: "WebGPU implementation status",
                },
              },
              { web: { uri: "https://example.com/caniuse-webgpu", title: "Can I use WebGPU" } },
            ],
            groundingSupports: [
              {
                segment: {
                  startIndex: 0,
                  endIndex: 80,
                  text: "Chrome and Edge ship WebGPU by default on desktop.",
                },
                groundingChunkIndices: [0],
                confidenceScores: [0.92],
              },
            ],
            webSearchQueries: ["WebGPU browser support 2026"],
          },
        },
        content:
          "Chrome and Edge ship WebGPU by default on desktop and Android. Firefox ships it on Windows and macOS with Linux behind a flag. Safari has it enabled on macOS and iOS as of the 26 releases. For a production app you can now assume WebGPU on evergreen browsers and keep a WebGL fallback only for older enterprise installs.",
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "attachments"),
      title: scenario(
        "Attachments",
        "Review a screenshot and a spec",
        "Attach an image and a PDF from the composer, then ask a question about them. Open the attachments on the user message.",
        "Image and document attachment chips render on the user message and the reply references them.",
      ),
      createdAt: at({ days: 2, hours: 12 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content: "Here is the settings screen and the spec. Does the screen match the spec?",
        data: {
          attachments: [
            {
              type: "image",
              url: svgDataUrl("Settings screenshot", "#1F2937"),
              name: "settings.png",
            },
            {
              type: "document",
              url: "data:text/plain;base64,U2V0dGluZ3Mgc2NyZWVuIHNwZWM6IHRocmVlIHRhYnMsIHNhdmUgYnV0dG9uIGJvdHRvbSByaWdodC4=",
              name: "settings-spec.txt",
            },
          ],
        },
      },
      {
        role: "assistant",
        usage: USAGE,
        content: `Mostly. Two differences against the spec:

1. The spec asks for three tabs. The screenshot shows four, the extra one is **Integrations**.
2. The save button is bottom left in the screenshot. The spec places it bottom right.

Everything else, including the section order and the destructive action styling, matches.`,
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "voice"),
      title: scenario(
        "Voice",
        "Read me the summary",
        "Press play on the assistant message to hear the generated speech. Use the microphone in the composer to send a spoken message.",
        "A speech player renders on the assistant reply. The user turn shows as a transcribed audio message.",
      ),
      createdAt: at({ days: 2, hours: 4 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content: [
          { type: "text", text: "Read me a two sentence summary of what a Durable Object is." },
          {
            type: "input_audio",
            input_audio: { data: SILENT_AUDIO_DATA_URL.split(",")[1], format: "wav" },
          },
        ],
        data: { realtime: { turnStartedAt: Date.parse(at({ days: 2, hours: 4 })), sequence: 1 } },
      },
      {
        role: "assistant",
        usage: USAGE,
        data: {
          realtime: { turnStartedAt: Date.parse(at({ days: 2, hours: 4 })), sequence: 2 },
          speech: {
            audioDataUrl: SILENT_AUDIO_DATA_URL,
            audioMimeType: "audio/wav",
            provider: "melotts",
            model: "@cf/myshell-ai/melotts",
            generatedAt: Date.parse(at({ days: 2, hours: 3, minutes: 58 })),
          },
        },
        content:
          "A Durable Object is a single instance of a class that owns its own storage and runs in exactly one place at a time. Cloudflare routes every request for a given id to that instance, which makes it a natural home for coordination, counters and websocket fan-out.",
      },
    ],
  );

  const mediaPending = thread(
    statements,
    {
      id: seedId("chat", "media-pending"),
      title: scenario(
        "Media",
        "Generate a launch poster (in progress)",
        "Watch the in-progress card. It keeps polling the seeded task, which never completes, so use it to test the pending state and cancel.",
        "An in-progress generation card renders with the progress hint. The background task shows on Attention.",
      ),
      createdAt: at({ hours: 1 }),
      run: { status: "running" },
    },
    [
      {
        role: "user",
        content:
          "Generate a poster for the Autumn launch: warm tones, a parrot, plenty of whitespace.",
      },
      {
        role: "assistant",
        status: "in_progress",
        content: "",
        data: {
          asyncInvocation: {
            provider: "replicate",
            id: seedId("prediction", "poster"),
            type: "image",
            status: "processing",
            pollIntervalMs: 4000,
            lastCheckedAt: at({ minutes: 55 }),
            contentHints: {
              placeholder: [{ type: "text", text: "Rendering the poster" }],
              progress: [
                {
                  type: "text",
                  text: "Replicate is rendering the poster, usually under a minute.",
                },
              ],
              failure: [{ type: "text", text: "The poster could not be rendered." }],
            },
          },
        },
      },
    ],
  );

  statements.push(
    insert("tasks", {
      id: seedId("task", "replicate-poster"),
      task_type: "replicate_polling",
      status: "running",
      priority: 3,
      user_id: OWNER.id,
      task_data: JSON.stringify({
        predictionId: seedId("prediction", "poster"),
        userId: OWNER.id,
        conversationId: mediaPending.conversationId,
        messageId: mediaPending.messageIds[1],
      }),
      created_by: "system",
      attempts: 3,
      last_attempted_at: at({ minutes: 55 }),
      created_at: at({ hours: 1 }),
      updated_at: at({ minutes: 55 }),
    }),
  );

  thread(
    statements,
    {
      id: seedId("chat", "media-done"),
      title: scenario(
        "Media",
        "Generated hero image",
        "Open the image, then find the same generation under Files. Ask for a variation to trigger a new generation.",
        "The completed generation renders inline and the output appears in Files with its revision history.",
      ),
      createdAt: at({ days: 1, hours: 9 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content: "Make a hero image of a parrot perched on a laptop, flat illustration style.",
      },
      {
        role: "assistant",
        usage: USAGE,
        data: {
          attachments: [
            { type: "image", url: svgDataUrl("Parrot on a laptop", "#0F766E"), name: "hero.png" },
          ],
          asyncInvocation: {
            provider: "replicate",
            id: seedId("prediction", "hero"),
            type: "image",
            status: "completed",
            completedAt: at({ days: 1, hours: 8, minutes: 58 }),
          },
        },
        content:
          "Here is the hero image. Flat illustration, muted teal background, the parrot is looking at the screen rather than the viewer so it reads as focused rather than cheeky.",
      },
    ],
  );

  const research = thread(
    statements,
    {
      id: seedId("chat", "research"),
      title: scenario(
        "Research",
        "Deep dive on D1 limits",
        "Expand the research card to see the run status and sources. Start a new research run from the composer action menu.",
        "The research view renders with a completed run, its sources and the report output.",
      ),
      createdAt: at({ days: 1, hours: 5 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content: "Run a deep research on Cloudflare D1 limits and how teams work around them.",
      },
      ...toolCall({
        name: "research",
        callId: "call_research_1",
        input: { query: "Cloudflare D1 limits and workarounds", depth: "deep" },
        result: "Research completed with 6 sources.",
        data: {
          responseType: "custom",
          renderer: "research",
          icon: "microscope",
          formattedName: "Research",
          asyncInvocation: {
            provider: "parallel",
            id: seedId("research", "d1-limits"),
            status: "completed",
            completedAt: at({ days: 1, hours: 4, minutes: 40 }),
          },
          data: {
            run: {
              run_id: seedId("research", "d1-limits"),
              status: "completed",
              provider: "parallel",
            },
            sources: [
              { title: "D1 limits", url: "https://developers.cloudflare.com/d1/platform/limits/" },
              {
                title: "D1 read replication",
                url: "https://developers.cloudflare.com/d1/best-practices/read-replication/",
              },
            ],
          },
        },
      }),
      {
        role: "assistant",
        usage: USAGE,
        citations: [
          "https://developers.cloudflare.com/d1/platform/limits/",
          "https://developers.cloudflare.com/d1/best-practices/read-replication/",
        ],
        content: `**Summary**

D1 is comfortable for single-region, moderate write workloads. The constraints that bite teams are the 10 GB database ceiling, the per-query row scan cost, and single-writer latency for multi-region apps.

**Common workarounds**

- Shard by tenant into many small databases rather than one large one.
- Enable read replication and route reads with sessions to keep consistency where it matters.
- Push hot counters and coordination into Durable Objects, keep D1 for the record of truth.
- Batch writes with \`batch()\` to stay inside per-request statement limits.

**Open questions**

- Whether the 10 GB limit will be raised for paid plans.
- How replication lag interacts with idempotency keys on retries.`,
      },
    ],
  );

  statements.push(
    insert("tasks", {
      id: seedId("task", "research-d1"),
      task_type: "research_polling",
      status: "completed",
      priority: 4,
      user_id: OWNER.id,
      task_data: JSON.stringify({
        runId: seedId("research", "d1-limits"),
        provider: "parallel",
        userId: OWNER.id,
        conversationId: research.conversationId,
      }),
      created_by: "system",
      attempts: 4,
      completed_at: at({ days: 1, hours: 4, minutes: 40 }),
      created_at: at({ days: 1, hours: 5 }),
      updated_at: at({ days: 1, hours: 4, minutes: 40 }),
    }),
    insert("task_executions", {
      id: seedId("task-exec", "research-d1"),
      task_id: seedId("task", "research-d1"),
      status: "completed",
      started_at: at({ days: 1, hours: 4, minutes: 41 }),
      completed_at: at({ days: 1, hours: 4, minutes: 40 }),
      execution_time_ms: 42_000,
      result_data: JSON.stringify({ status: "completed", sources: 6 }),
    }),
  );

  const goal = thread(
    statements,
    {
      id: seedId("chat", "goal"),
      title: scenario(
        "Goals",
        "Ship the changelog",
        "Open the goal card at the top of the thread. Send 'continue' to iterate, or clear the goal from the card.",
        "An active goal renders with progress entries and evidence, and the thread shows the goal marker parts.",
      ),
      createdAt: at({ days: 1, hours: 2 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content: "/goal Draft and finalise the September changelog with three verified entries.",
      },
      {
        role: "assistant",
        usage: USAGE,
        parts: [
          {
            type: "goal",
            event: "set",
            label: "Goal set",
            objective: "Draft and finalise the September changelog with three verified entries.",
          },
          {
            type: "text",
            text: "Goal accepted. First pass below, each entry needs a verifying link before I mark it done.\n\n1. Scheduled runs\n2. Quoted selections in chat\n3. Machine handoffs from mobile",
          },
        ],
        content:
          "Goal accepted. First pass below, each entry needs a verifying link before I mark it done.",
      },
      { role: "user", content: "continue" },
      {
        role: "assistant",
        usage: USAGE,
        parts: [
          { type: "goal", event: "resumed", label: "Iteration 2" },
          {
            type: "text",
            text: "Two of three entries now have evidence. Machine handoffs still need the release commit, so the goal stays active.",
          },
        ],
        content:
          "Two of three entries now have evidence. Machine handoffs still need the release commit, so the goal stays active.",
      },
    ],
  );

  statements.push(
    insert("goal", {
      id: seedId("goal", "changelog"),
      conversation_id: goal.conversationId,
      user_id: OWNER.id,
      objective: "Draft and finalise the September changelog with three verified entries.",
      status: "active",
      source: "user",
      iteration_count: 2,
      stall_streak: 0,
      tokens_spent: 2_311,
      progress: [
        {
          iteration: 1,
          surface: "chat",
          summary: "Drafted three candidate entries.",
          evidence: ["Draft in message 2"],
          next: "Verify each entry against the release commits.",
          at: at({ days: 1, hours: 1, minutes: 58 }),
        },
        {
          iteration: 2,
          surface: "chat",
          summary: "Verified scheduled runs and quoted selections.",
          evidence: ["Commit 2c3a78491", "Commit 070281029"],
          next: "Find the machine handoff release commit.",
          at: at({ days: 1, hours: 1, minutes: 50 }),
        },
      ],
      evidence: [
        {
          claim: "Scheduled runs shipped",
          route: "git log",
          evidence_surface: "chat",
          status: "confirmed",
        },
        {
          claim: "Quoted selections shipped",
          route: "git log",
          evidence_surface: "chat",
          status: "confirmed",
        },
        {
          claim: "Machine handoffs shipped",
          route: "git log",
          evidence_surface: "chat",
          status: "blocked",
          remaining_uncertainty: "Release commit not yet located.",
        },
      ],
      created_from_message_id: goal.messageIds[0],
      created_at: at({ days: 1, hours: 2 }),
      updated_at: at({ days: 1, hours: 1, minutes: 50 }),
      last_continued_at: at({ days: 1, hours: 1, minutes: 50 }),
    }),
  );

  thread(
    statements,
    {
      id: seedId("chat", "permission-supervised"),
      title: scenario(
        "Permissions",
        "Supervised run awaiting approval",
        "Approve or decline the pending tool call. Change the permission mode from the conversation header and start another run.",
        "The run shows as awaiting approval with an approval card. The header displays the supervised mode.",
      ),
      createdAt: at({ hours: 3 }),
      permissionMode: "supervised",
      run: {
        status: "awaiting_approval",
        contextJson: contextSnapshot(seedId("chat", "permission-supervised"), {
          usage: { inputTokens: 1800, contextWindow: 128000, source: "estimated" },
          approvals: [
            {
              id: "call_write_1",
              type: "approval",
              status: "pending",
              toolName: "write_file",
              messageId: `${seedId("chat", "permission-supervised")}-m3`,
            },
          ],
        }),
      },
    },
    [
      {
        role: "user",
        content: "Rename every occurrence of 'colour' to 'color' in the docs folder.",
      },
      {
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool_use",
            name: "write_file",
            toolCallId: "call_write_1",
            input: { path: "docs/theme.md", replacements: 14 },
          },
        ],
      },
      {
        role: "tool",
        name: "write_file",
        toolCallId: "call_write_1",
        toolCallArguments: { path: "docs/theme.md", replacements: 14 },
        status: "pending",
        content: "Approval required before writing 14 replacements to docs/theme.md.",
        data: {
          responseType: "custom",
          renderer: "approval_request",
          icon: "shield",
          formattedName: "Approval needed",
          data: {
            toolName: "write_file",
            summary: "Write 14 replacements to docs/theme.md",
            arguments: { path: "docs/theme.md", replacements: 14 },
          },
        },
        model: null,
        provenance: null,
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "permission-full"),
      title: scenario(
        "Permissions",
        "Full access run",
        "Compare the header badge with the supervised conversation. Runs here never pause for approval.",
        "The header shows full access and tool calls execute without an approval card.",
      ),
      createdAt: at({ days: 4, hours: 9 }),
      permissionMode: "full_access",
      run: { status: "succeeded" },
    },
    [
      { role: "user", content: "Clean the build folder and rerun the tests." },
      ...toolCall({
        name: "run_command",
        callId: "call_cmd_1",
        input: { command: "rm -rf dist && pnpm test" },
        result: "Test Files 12 passed (12)\nTests 88 passed (88)",
        data: { responseType: "text", icon: "terminal", formattedName: "Run command" },
      }),
      {
        role: "assistant",
        usage: USAGE,
        content: "Build folder removed and the suite is green: 12 files, 88 tests.",
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "compaction"),
      title: scenario(
        "Compaction",
        "Long thread that was compacted",
        "Expand the compaction summary. Archived messages sit under it. Send a message to confirm the summary is used as context.",
        "A compaction card renders with coverage counts and the archived predecessors are collapsed.",
      ),
      createdAt: at({ days: 9 }),
      run: { status: "succeeded" },
    },
    [
      { role: "user", content: "Let's design the schema for a habit tracker.", isArchived: true },
      {
        role: "assistant",
        content: "Start with users, habits and habit_events. Keep streaks derived.",
        isArchived: true,
        usage: USAGE,
      },
      { role: "user", content: "What about time zones?", isArchived: true },
      {
        role: "assistant",
        content:
          "Store events in UTC and the user's zone on the habit. Derive local days at read time.",
        isArchived: true,
        usage: USAGE,
      },
      {
        role: "assistant",
        content: "Conversation compacted.",
        parts: [
          {
            type: "compaction",
            status: "completed",
            label: "Compacted 4 messages",
            coverage: {
              coveredMessageIds: [1, 2, 3, 4].map(
                (index) => `${seedId("chat", "compaction")}-m${index}`,
              ),
              coveredMessageCount: 4,
              candidateMessageCount: 4,
              summaryInputCharacters: 412,
              strategy: "model_summary",
            },
          },
          {
            type: "snapshot",
            title: "Habit tracker schema",
            summary:
              "Agreed tables: users, habits (with time zone), habit_events in UTC. Streaks are derived, not stored. Open question: reminders.",
          },
        ],
      },
      { role: "user", content: "Right, reminders. Push or email?" },
      {
        role: "assistant",
        usage: USAGE,
        content:
          "Push first. It is cheaper and the habit is usually tied to a moment in the day. Keep email as the weekly digest.",
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "retry"),
      title: scenario(
        "Runs",
        "Retrying after a rate limit",
        "Watch the retry banner count down. Cancel the run from the composer to exercise the cancel path.",
        "A retry banner shows attempt 2 of 3 with the provider reason, and the assistant message is in progress.",
      ),
      createdAt: at({ minutes: 6 }),
      run: {
        status: "running",
        retryJson: {
          protocolVersion: 1,
          step: 1,
          attempt: 2,
          maxAttempts: 3,
          runRetry: 1,
          maxRunRetries: 2,
          phase: "waiting",
          classification: "rate_limited",
          reason: "The provider returned 429 and asked us to wait.",
          scheduledAt: at({ minutes: 2 }),
          retryAt: ahead({ minutes: 1 }),
        },
      },
    },
    [
      { role: "user", content: "Summarise the last five commits on main." },
      { role: "assistant", status: "in_progress", content: "" },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "failed"),
      title: scenario(
        "Runs",
        "Failed run banner",
        "Use the retry action on the banner. Check the run events in the context panel.",
        "A failed run banner explains the provider error and offers retry.",
      ),
      createdAt: at({ days: 1, hours: 14 }),
      run: {
        status: "failed",
        terminalReason: "provider_error: openai returned 400 Bad Request (tool schema rejected)",
      },
    },
    [
      { role: "user", content: "Use the code interpreter to plot the usage numbers." },
      {
        role: "assistant",
        status: "error",
        content: "",
        data: { error: "openai error: code_interpreter is not enabled for this model." },
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "cancelled"),
      title: scenario(
        "Runs",
        "Cancelled by the user",
        "Note the partial reply is kept. Send a new message to start a fresh run.",
        "A cancelled banner appears and the partial assistant text remains readable.",
      ),
      createdAt: at({ days: 1, hours: 16 }),
      run: { status: "cancelled", terminalReason: "cancelled_by_user" },
    },
    [
      { role: "user", content: "Write a 2000 word essay on the history of the semicolon." },
      {
        role: "assistant",
        status: "complete",
        content:
          "The semicolon first appears in Venice in 1494, in a book set by Aldus Manutius, who wanted a pause longer than a comma but",
      },
    ],
  );

  const parent = thread(
    statements,
    {
      id: seedId("chat", "delegation"),
      title: scenario(
        "Delegations",
        "Parent with two delegates",
        "Open the delegation card, click a delegate to view its transcript in the drawer, then use Stop all. Message a delegate to see the handle in use.",
        "A delegation card lists one done and one running delegate. The timeline shows elapsed time and the handles panel lists the grant.",
      ),
      createdAt: at({ hours: 2 }),
      run: { status: "awaiting_input" },
    },
    [
      {
        role: "user",
        content:
          "Split this up: get the Researcher to gather sources on WebSocket back-pressure, and the Editor to draft the intro. Wait for both.",
      },
      {
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool_use",
            name: "delegate",
            toolCallId: "call_delegate_1",
            input: {
              teammate: "Researcher",
              goal: "Gather sources on WebSocket back-pressure",
              wait_for: "all",
            },
          },
        ],
      },
      {
        role: "tool",
        name: "delegate",
        toolCallId: "call_delegate_1",
        toolCallArguments: {
          teammate: "Researcher",
          goal: "Gather sources on WebSocket back-pressure",
          wait_for: "all",
        },
        content: JSON.stringify({ delegations: [], canControl: true }),
        data: {
          responseType: "custom",
          renderer: "delegation_card",
          icon: "users",
          formattedName: "Delegations",
          data: {
            delegations: [
              delegationJson("researcher", "done", {
                summary: "Collected 7 sources with notes on flow control in browsers and Node.",
                outputIds: [seedId("output", "backpressure-sources")],
              }),
              delegationJson("editor", "running", null),
            ],
            canControl: true,
          },
        },
        model: null,
        provenance: null,
      },
    ],
  );

  conversationIds.delegation = parent.conversationId;

  const researcherChild = thread(
    statements,
    {
      id: seedId("chat", "delegate-researcher"),
      title: "Researcher · WebSocket back-pressure sources",
      type: "delegate",
      createdAt: at({ hours: 1, minutes: 58 }),
      parentConversationId: parent.conversationId,
      parentMessageId: parent.messageIds[1],
      run: { status: "succeeded", trigger: "delegation" },
    },
    [
      {
        role: "user",
        content:
          "Gather sources on WebSocket back-pressure. Return a list with one line per source.",
      },
      {
        role: "assistant",
        mode: "teammate",
        usage: USAGE,
        content: `1. MDN, WebSocket bufferedAmount, the only browser-side signal.
2. Node ws docs, the drain event and highWaterMark.
3. RFC 6455 section 5, no protocol level flow control.
4. Cloudflare Durable Objects hibernation notes.
5. A 2024 post on token buckets per socket.
6. uWebSockets backpressure page.
7. The Socket.IO volatile emit explanation.`,
      },
    ],
  );

  const editorChild = thread(
    statements,
    {
      id: seedId("chat", "delegate-editor"),
      title: "Editor · Draft the intro",
      type: "delegate",
      createdAt: at({ hours: 1, minutes: 57 }),
      parentConversationId: parent.conversationId,
      parentMessageId: parent.messageIds[1],
      run: { status: "running", trigger: "delegation" },
    },
    [
      { role: "user", content: "Draft a 120 word intro for a post on WebSocket back-pressure." },
      {
        role: "assistant",
        mode: "teammate",
        status: "in_progress",
        content: "Every socket is a promise you cannot always keep.",
      },
    ],
  );

  function delegationJson(kind, state, result) {
    const parentId = seedId("chat", "delegation");
    const child =
      kind === "researcher"
        ? seedId("chat", "delegate-researcher")
        : seedId("chat", "delegate-editor");
    const teammate = kind === "researcher" ? teammates.researcher : teammates.editor;

    return {
      id: seedId("delegation", kind),
      parentConversationId: parentId,
      childConversationId: child,
      parentRunId: `${parentId}-run`,
      depth: 1,
      teammateId: teammate,
      goal: kind === "researcher" ? "Gather sources on WebSocket back-pressure" : "Draft the intro",
      waitFor: "all",
      budget: { maxCreditMicros: 25_000_000, maxSteps: 12, deadline: ahead({ hours: 22 }) },
      state,
      result,
      createdAt: at({ hours: 1, minutes: 59 }),
      updatedAt: at({ minutes: 30 }),
    };
  }

  for (const [kind, child, state, result] of [
    [
      "researcher",
      researcherChild,
      "done",
      {
        summary: "Collected 7 sources with notes on flow control in browsers and Node.",
        outputIds: [seedId("output", "backpressure-sources")],
      },
    ],
    ["editor", editorChild, "running", null],
  ]) {
    statements.push(
      insert("delegation", {
        id: seedId("delegation", kind),
        parent_conversation_id: parent.conversationId,
        child_conversation_id: child.conversationId,
        parent_run_id: parent.runId,
        depth: 1,
        teammate_id: kind === "researcher" ? teammates.researcher : teammates.editor,
        goal:
          kind === "researcher" ? "Gather sources on WebSocket back-pressure" : "Draft the intro",
        wait_for: "all",
        max_credit_micros: 25_000_000,
        max_steps: 12,
        deadline: ahead({ hours: 22 }),
        state,
        result_json: result,
        created_at: at({ hours: 1, minutes: 59 }),
        updated_at: at({ minutes: 30 }),
      }),
      insert("conversation_handle", {
        id: `handle_${seedId("delegation", kind)}`,
        conversation_id: parent.conversationId,
        delegation_id: seedId("delegation", kind),
        granted_by: "spawn",
        granted_at: at({ hours: 1, minutes: 59 }),
        expires_at: ahead({ hours: 22 }),
        revoked_at: state === "done" ? at({ minutes: 30 }) : null,
      }),
    );
  }

  statements.push(
    insert("tasks", {
      id: `delegation_task_${seedId("delegation", "editor")}`,
      task_type: "delegation_run",
      status: "running",
      priority: 4,
      user_id: OWNER.id,
      task_data: JSON.stringify({
        delegationId: seedId("delegation", "editor"),
        projectId: null,
        enabledTools: [],
      }),
      created_by: "system",
      attempts: 1,
      last_attempted_at: at({ hours: 1, minutes: 57 }),
      created_at: at({ hours: 1, minutes: 59 }),
      updated_at: at({ hours: 1, minutes: 57 }),
    }),
    insert("output", {
      id: seedId("output", "backpressure-sources"),
      created_by_user_id: OWNER.id,
      conversation_id: researcherChild.conversationId,
      capability_id: "documents",
      kind: "document",
      title: "WebSocket back-pressure sources",
      status: "ready",
      sensitivity: "personal",
      content: {
        format: "markdown",
        body: "# Sources\n\n1. MDN bufferedAmount\n2. Node ws drain\n3. RFC 6455 §5\n4. Durable Objects hibernation\n5. Token buckets per socket\n6. uWebSockets backpressure\n7. Socket.IO volatile emit",
      },
      revision: 1,
      created_at: at({ minutes: 32 }),
      updated_at: at({ minutes: 32 }),
      revision_created_by_user_id: OWNER.id,
      revision_created_at: at({ minutes: 32 }),
      revision_operation: "created",
    }),
    insert("output_revision", {
      output_id: seedId("output", "backpressure-sources"),
      revision: 1,
      title: "WebSocket back-pressure sources",
      status: "ready",
      sensitivity: "personal",
      content: { format: "markdown", body: "# Sources\n\n1. MDN bufferedAmount\n2. Node ws drain" },
      created_by_user_id: OWNER.id,
      created_at: at({ minutes: 32 }),
      operation: "created",
    }),
  );

  thread(
    statements,
    {
      id: seedId("chat", "meta"),
      title: scenario(
        "Meta assistant",
        "Ask Poly",
        "Press the Ask Poly button (⌘J) and ask 'find my dinner plan'. Poly navigates to the conversation.",
        "The meta thread shows navigation results and clicking one opens the destination.",
      ),
      type: "meta",
      createdAt: at({ days: 2, hours: 2 }),
      modelId: SEED_MODEL_SMALL,
      run: { status: "succeeded" },
    },
    [
      { role: "user", content: "Find the conversation where I planned dinners." },
      ...toolCall({
        name: "find_places",
        callId: "call_find_1",
        input: { query: "dinner plan" },
        result: {
          places: [
            {
              kind: "conversation",
              id: plain.conversationId,
              title: "[Chat] Plan a week of dinners",
            },
          ],
        },
        data: { responseType: "hidden" },
      }),
      {
        role: "assistant",
        model: SEED_MODEL_SMALL,
        provenance: { site: "hosted", vendor: "workers-ai", model: SEED_MODEL_SMALL },
        data: {
          metaNavigation: {
            destinations: [
              {
                kind: "conversation",
                id: plain.conversationId,
                href: `/chat/${plain.conversationId}`,
                label: "Plan a week of dinners",
              },
            ],
          },
        },
        content: "Found it. Opening 'Plan a week of dinners' from six days ago.",
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "shared"),
      title: scenario(
        "Sharing",
        "Publicly shared conversation",
        "Open the share dialog from the header. Visit the public link in a private window to see the read-only view.",
        "The conversation is marked public and the share link renders the thread without the composer.",
      ),
      createdAt: at({ days: 12 }),
      isPublic: true,
      shareId: "polychat-seed-share-dinner-planning",
      run: { status: "succeeded" },
    },
    [
      { role: "user", content: "Give me a one paragraph explanation of what Polychat is." },
      {
        role: "assistant",
        usage: USAGE,
        content:
          "Polychat is a personal and team assistant that runs on hosted models, your own machine or the browser. Chat handles the everyday questions and Work turns those chats into tracked tasks with teammates, sandboxes and approvals.",
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "archived"),
      title: scenario(
        "Archive",
        "An archived conversation",
        "Open the archive from the sidebar filter and restore this conversation.",
        "The conversation only shows under the archived filter until restored.",
      ),
      createdAt: at({ days: 40 }),
      isArchived: true,
    },
    [
      { role: "user", content: "Remind me what the capital of Australia is." },
      {
        role: "assistant",
        usage: USAGE,
        content: "Canberra. Sydney and Melbourne were both passed over to settle the argument.",
      },
    ],
  );

  const cookingGroup = seedId("group", "cooking");

  statements.push(
    insert("conversation_group", {
      id: cookingGroup,
      owner_user_id: OWNER.id,
      name: "Cooking",
      normalised_name: "cooking",
      created_by_user_id: OWNER.id,
      created_at: at({ days: 7 }),
    }),
    insert("conversation_group_membership", {
      conversation_id: plain.conversationId,
      group_id: cookingGroup,
      assigned_by_user_id: OWNER.id,
      created_at: at({ days: 6 }),
    }),
  );

  for (const [slug, title, createdAt, flags] of [
    ["sourdough", "Sourdough starter rescue", at({ days: 8 }), { unread: true }],
    ["knives", "Which chef's knife", at({ days: 15 }), { snoozedUntil: ahead({ days: 2 }) }],
  ]) {
    const built = thread(
      statements,
      {
        id: seedId("chat", slug),
        title: scenario(
          "Groups",
          title,
          "Open the Cooking group in the sidebar. This one is " +
            (flags.unread ? "unread." : "snoozed for two days."),
          "The group filter lists three cooking conversations with unread and snoozed indicators.",
        ),
        createdAt,
        ...flags,
      },
      [
        {
          role: "user",
          content:
            slug === "sourdough"
              ? "My starter smells like acetone. Is it dead?"
              : "Recommend a chef's knife under £80.",
        },
        {
          role: "assistant",
          usage: USAGE,
          content:
            slug === "sourdough"
              ? "Not dead, hungry. The acetone smell is alcohol from starved yeast. Discard most of it and feed twice a day for three days."
              : "The Victorinox Fibrox 20cm. Light, sharp out of the box and easy to maintain on a whetstone.",
        },
      ],
    );

    statements.push(
      insert("conversation_group_membership", {
        conversation_id: built.conversationId,
        group_id: cookingGroup,
        assigned_by_user_id: OWNER.id,
        created_at: createdAt,
      }),
    );
  }

  thread(
    statements,
    {
      id: seedId("chat", "second-opinion"),
      title: scenario(
        "Second opinion",
        "Two models on one question",
        "Use the response controls to request a second opinion, then a consensus.",
        "The second reply is marked as a second opinion from a different model.",
      ),
      createdAt: at({ days: 3, hours: 16 }),
      run: { status: "succeeded" },
    },
    [
      { role: "user", content: "Should a small team use monorepo or polyrepo?" },
      {
        role: "assistant",
        usage: USAGE,
        content:
          "Monorepo. One CI, one dependency graph, and atomic changes across packages. Split only when teams stop sharing releases.",
      },
      {
        role: "assistant",
        model: "llama-3.3-70b-instruct",
        provenance: { site: "hosted", vendor: "workers-ai", model: "llama-3.3-70b-instruct" },
        usage: USAGE,
        data: {
          opinion: {
            mode: "second-opinion",
            sourceMessageId: `${seedId("chat", "second-opinion")}-m2`,
            modelIds: ["llama-3.3-70b-instruct"],
          },
        },
        content:
          "Agree on monorepo, with one caveat: enforce package boundaries with lint rules from day one or the graph turns into a ball of string.",
      },
    ],
  );

  const saved = thread(
    statements,
    {
      id: seedId("chat", "runtimes"),
      title: scenario(
        "Runtimes",
        "Replies from device, browser and machine",
        "Hover the provenance mark on each reply. Switch the model selector to the MacBook machine and send a message.",
        "Provenance marks show hosted, browser, on-device and machine origins with the machine label.",
      ),
      createdAt: at({ days: 1, hours: 20 }),
    },
    [
      { role: "user", content: "Say hello from wherever you are running.", platform: "mobile" },
      {
        role: "assistant",
        model: "llama-3.2-3b-instruct",
        provenance: { site: "device", vendor: "apple", model: "llama-3.2-3b-instruct" },
        platform: "mobile",
        content: "Hello from the phone. This reply never left the device.",
      },
      { role: "user", content: "And from the browser?" },
      {
        role: "assistant",
        model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        provenance: {
          site: "browser",
          vendor: "web-llm",
          model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        },
        content: "Hello from WebGPU. The weights are cached in this tab.",
      },
      { role: "user", content: "Now from the MacBook." },
      {
        role: "assistant",
        model: "llama3.3:70b",
        provenance: {
          site: "machine",
          machineId: MACHINE_ID,
          vendor: "ollama",
          model: "llama3.3:70b",
        },
        content: "Hello from Nick's MacBook Pro over the machine relay. Ollama served this one.",
      },
    ],
  );

  statements.push(
    insert("message_user_state", {
      id: seedId("saved", "machine-reply"),
      user_id: OWNER.id,
      conversation_id: saved.conversationId,
      message_id: saved.messageIds[5],
      note: "Good example of the machine relay working end to end.",
      saved_at: at({ days: 1, hours: 19 }),
    }),
  );

  thread(
    statements,
    {
      id: seedId("chat", "teammate"),
      title: scenario(
        "Teammates",
        "Chat with the Editor",
        "Pick the Editor teammate from the model selector and paste a paragraph. Rate the reply with thumbs up or down.",
        "Replies are marked as teammate mode and the feedback control records a verdict.",
      ),
      createdAt: at({ days: 2, hours: 9 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content:
          "Edit: In today's fast paced world it is more important than ever to leverage AI to unlock value.",
      },
      {
        role: "assistant",
        mode: "teammate",
        usage: USAGE,
        content:
          "Cut it entirely. It says nothing. Start with the thing you built and the problem it removes.",
      },
    ],
  );

  thread(
    statements,
    {
      id: seedId("chat", "code"),
      title: scenario(
        "Formatting",
        "Code, tables and maths",
        "Copy a code block with the copy button. Check the maths renders and the table scrolls on narrow screens.",
        "Syntax highlighted code, a wide table and inline maths all render.",
      ),
      createdAt: at({ days: 5, hours: 2 }),
      run: { status: "succeeded" },
    },
    [
      {
        role: "user",
        content:
          "Show me a debounce function in TypeScript, a comparison table, and the formula for compound interest.",
      },
      {
        role: "assistant",
        usage: USAGE,
        content: `\`\`\`ts
export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
\`\`\`

| Approach | Fires | Best for | Caveat |
| --- | --- | --- | --- |
| Debounce | After quiet period | Search boxes | Loses intermediate values |
| Throttle | At most every N ms | Scroll handlers | Last call may be dropped |
| requestAnimationFrame | Next frame | Layout reads | Not for network calls |

Compound interest: $A = P\\left(1 + \\frac{r}{n}\\right)^{nt}$ where $P$ is the principal, $r$ the annual rate, $n$ the compounding periods per year and $t$ the years.`,
      },
    ],
  );

  statements.push(
    insert("tasks", {
      id: seedId("task", "synthesis-done"),
      task_type: "memory_synthesis",
      status: "completed",
      priority: 5,
      user_id: OWNER.id,
      task_data: JSON.stringify({ userId: OWNER.id, namespace: "personal" }),
      created_by: "user",
      attempts: 1,
      completed_at: at({ days: 2, hours: 1 }),
      created_at: at({ days: 2, hours: 2 }),
      updated_at: at({ days: 2, hours: 1 }),
    }),
    insert("task_executions", {
      id: seedId("task-exec", "synthesis-done"),
      task_id: seedId("task", "synthesis-done"),
      status: "completed",
      started_at: at({ days: 2, hours: 1, minutes: 3 }),
      completed_at: at({ days: 2, hours: 1 }),
      execution_time_ms: 180_000,
      result_data: JSON.stringify({ memoriesWritten: 4 }),
    }),
    insert("tasks", {
      id: seedId("task", "synthesis-failed"),
      task_type: "memory_synthesis",
      status: "failed",
      priority: 5,
      user_id: OWNER.id,
      task_data: JSON.stringify({ userId: OWNER.id, namespace: "personal" }),
      created_by: "user",
      attempts: 3,
      max_attempts: 3,
      last_attempted_at: at({ days: 5 }),
      error_message: "Embedding provider timed out after 30s",
      created_at: at({ days: 5, hours: 1 }),
      updated_at: at({ days: 5 }),
    }),
    insert("tasks", {
      id: seedId("task", "synthesis-scheduled"),
      task_type: "memory_synthesis",
      status: "pending",
      priority: 6,
      user_id: OWNER.id,
      task_data: JSON.stringify({ userId: OWNER.id, namespace: "personal" }),
      schedule_type: "recurring",
      cron_expression: "0 3 * * *",
      scheduled_at: ahead({ hours: 9 }),
      created_by: "user",
      created_at: at({ days: 20 }),
      updated_at: at({ days: 1 }),
    }),
  );

  for (const [name, content] of [
    [
      "profile",
      "# Nick\n\n- Founder of Polychat, engineer by trade\n- Prefers British English and dry humour\n- Dislikes exclamation marks and filler\n- Eats fish twice a week, no red meat",
    ],
    [
      "projects",
      "# Current projects\n\n- Polychat Autumn launch (Northstar Studio workspace)\n- Habit tracker side project, schema agreed\n- Blog post on WebSocket back-pressure",
    ],
    ["debugging-guide", seedGuideMarkdown()],
  ]) {
    const documentId = seedId("memory", name);

    statements.push(
      insert("memory_document", {
        id: documentId,
        scope_type: "personal",
        scope_id: String(OWNER.id),
        name,
        content,
        revision: 1,
        created_by: OWNER.id,
        created_at: at({ days: 10 }),
        updated_at: at({ days: 1 }),
      }),
      insert("memory_document_revision", {
        id: `${documentId}-r1`,
        document_id: documentId,
        revision: 1,
        content,
        change_note: "Seeded",
        created_by: OWNER.id,
        created_at: at({ days: 10 }),
      }),
    );
  }

  const noteId = seedId("output", "release-notes");
  const canvasId = seedId("output", "canvas-hero");

  statements.push(
    insert("output", {
      id: noteId,
      created_by_user_id: OWNER.id,
      capability_id: "notes",
      kind: "note",
      title: "Release notes draft",
      status: "ready",
      sensitivity: "personal",
      content: {
        format: "markdown",
        body: "## September\n\n- Scheduled runs\n- Quoted selections\n- Machine handoffs (pending)",
      },
      revision: 2,
      created_at: at({ days: 4 }),
      updated_at: at({ days: 1 }),
      revision_created_by_user_id: OWNER.id,
      revision_created_at: at({ days: 1 }),
      revision_operation: "updated",
    }),
    insert("output_revision", {
      output_id: noteId,
      revision: 1,
      title: "Release notes draft",
      status: "ready",
      sensitivity: "personal",
      content: { format: "markdown", body: "## September\n\n- Scheduled runs" },
      created_by_user_id: OWNER.id,
      created_at: at({ days: 4 }),
      operation: "created",
    }),
    insert("output_revision", {
      output_id: noteId,
      revision: 2,
      title: "Release notes draft",
      status: "ready",
      sensitivity: "personal",
      content: {
        format: "markdown",
        body: "## September\n\n- Scheduled runs\n- Quoted selections\n- Machine handoffs (pending)",
      },
      created_by_user_id: OWNER.id,
      created_at: at({ days: 1 }),
      operation: "updated",
    }),
    insert("output_share", {
      id: seedId("share", "release-notes"),
      output_id: noteId,
      token_hash: sha256Hex("polychat-seed-share-release-notes"),
      permission: "view",
      created_by_user_id: OWNER.id,
      created_at: at({ days: 1 }),
    }),
    insert("output", {
      id: canvasId,
      created_by_user_id: OWNER.id,
      conversation_id: seedId("chat", "media-done"),
      capability_id: "canvas",
      group_id: "black-forest-labs/flux-2-pro",
      kind: "generation",
      title: "Parrot on a laptop",
      status: "ready",
      sensitivity: "personal",
      content: {
        modelId: "replicate-flux-2-pro",
        modelName: "FLUX.2 Pro",
        provider: "replicate",
        mode: "image",
        status: "succeeded",
        createdAt: at({ days: 1, hours: 9 }),
        input: {
          prompt: "A parrot perched on a laptop, flat illustration style",
          aspect_ratio: "16:9",
        },
        output: svgDataUrl("Parrot on a laptop", "#0F766E"),
        predictionData: { id: seedId("prediction", "hero"), status: "succeeded" },
      },
      revision: 1,
      created_at: at({ days: 1, hours: 9 }),
      updated_at: at({ days: 1, hours: 8, minutes: 58 }),
    }),
    insert("output_revision", {
      output_id: canvasId,
      revision: 1,
      title: "Parrot on a laptop",
      status: "ready",
      sensitivity: "personal",
      content: { status: "succeeded" },
      created_by_user_id: OWNER.id,
      created_at: at({ days: 1, hours: 9 }),
      operation: "created",
    }),
  );

  const collectionId = seedId("collection", "reading");

  statements.push(
    insert("source", {
      id: seedId("source", "d1-limits"),
      created_by_user_id: OWNER.id,
      kind: "url",
      title: "Cloudflare D1 limits",
      status: "available",
      external_uri: "https://developers.cloudflare.com/d1/platform/limits/",
      provider: "web",
      metadata: { fetchedAt: at({ days: 1, hours: 5 }), wordCount: 1200 },
      created_at: at({ days: 1, hours: 5 }),
      updated_at: at({ days: 1, hours: 5 }),
    }),
    insert("source", {
      id: seedId("source", "style-guide"),
      created_by_user_id: OWNER.id,
      kind: "text",
      title: "House style guide",
      status: "available",
      content:
        "Use British English. Lead with the problem. Bold key phrases. No exclamation marks. Em-dashes are fine.",
      metadata: { characters: 110 },
      created_at: at({ days: 30 }),
      updated_at: at({ days: 30 }),
    }),
    insert("source", {
      id: seedId("source", "failed-upload"),
      created_by_user_id: OWNER.id,
      kind: "file",
      title: "quarterly-numbers.xlsx",
      status: "failed",
      filename: "quarterly-numbers.xlsx",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      byte_size: 48_211,
      metadata: { error: "Unsupported spreadsheet features: pivot tables" },
      created_at: at({ days: 2 }),
      updated_at: at({ days: 2 }),
    }),
    insert("source_collection", {
      id: collectionId,
      created_by_user_id: OWNER.id,
      title: "Reading list",
      description: "Sources worth citing in the back-pressure post.",
      kind: "general",
      created_at: at({ days: 3 }),
      updated_at: at({ days: 1 }),
    }),
    insert("source_collection_member", {
      collection_id: collectionId,
      source_id: seedId("source", "d1-limits"),
      created_at: at({ days: 1 }),
    }),
    insert("source_collection_member", {
      collection_id: collectionId,
      source_id: seedId("source", "style-guide"),
      created_at: at({ days: 3 }),
    }),
  );

  return { statements, conversationIds };
}

export function seedGuideMarkdown() {
  const lines = [
    "# Seed debugging guide",
    "",
    "Every seeded conversation is tagged with its scenario. Work through them in order.",
    "",
  ];

  for (const item of SCENARIOS) {
    lines.push(
      `## [${item.tag}] ${item.title}`,
      "",
      `**Try:** ${item.tryThis}`,
      "",
      `**Expect:** ${item.expect}`,
      "",
    );
  }

  lines.push(
    "## Work",
    "",
    "**Try:** Open the Northstar Studio workspace. The Autumn launch project has a task in every board column, a coding sandbox run with evidence, and a pending invitation.",
    "",
    "**Expect:** Attention lists the blocked and review tasks, the run evidence panel shows changed files and the quality gate, and the audit log records each change.",
    "",
  );

  return lines.join("\n");
}

export function guideStatements() {
  const statements = [];
  const built = buildThread(
    {
      userId: OWNER.id,
      id: seedId("chat", "guide"),
      title: "Start here · Seed guide",
      createdAt: at({ minutes: 1 }),
      pinned: true,
    },
    [
      {
        role: "user",
        content: "What is in this seeded database and how do I exercise each feature?",
      },
      { role: "assistant", content: seedGuideMarkdown(), provenance: null, model: null },
    ],
  );

  statements.push(...built.statements);

  return statements;
}

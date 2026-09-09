import {
  at,
  createUserKeyPair,
  credits,
  insert,
  period,
  seedId,
  SEED_MODEL,
  sha256Base64Url,
  sha256Hex,
} from "./sql.mjs";

export const OWNER = {
  id: 1,
  name: "Nicholas Griffin",
  email: "me@nicholasgriffin.co.uk",
  githubUsername: "nicholasgriffintn",
  githubId: "12116098",
  avatarUrl: "https://avatars.githubusercontent.com/u/12116098?v=4",
};

export const COLLEAGUES = [
  {
    id: 9001,
    name: "Priya Raman",
    email: "priya@northstar.example",
    role: "admin",
    nickname: "Priya",
    jobRole: "Design lead",
  },
  {
    id: 9002,
    name: "Tom Okafor",
    email: "tom@northstar.example",
    role: "member",
    nickname: "Tom",
    jobRole: "Engineer",
  },
  {
    id: 9003,
    name: "Aisha Bello",
    email: "aisha@northstar.example",
    role: "member",
    nickname: "Aisha",
    jobRole: "Product manager",
  },
];

export const SESSION_TOKEN = ["polychat", "seed", "session", OWNER.githubUsername].join("-");
export const API_KEY = ["ak", "seed", OWNER.githubUsername, "debugging".padEnd(24, "0")].join("_");
export const MACHINE_ID = seedId("machine", "macbook");

const LOCAL_IPS = ["unknown", "127.0.0.1", "::1", "::ffff:127.0.0.1", "0.0.0.0"];
const REVEAL_UNAVAILABLE = ["seeded", "placeholder", "reveal", "unavailable"].join("-");

function encryptionColumns(keys) {
  if (!keys) {
    return {};
  }

  return Object.fromEntries([
    ["public_key", keys.publicKey],
    ["private_key", keys.privateKey],
  ]);
}

export async function identityStatements({ serverKey }) {
  const statements = [];
  const keys = serverKey ? await createUserKeyPair(serverKey) : null;

  statements.push(
    insert(
      "user",
      {
        id: OWNER.id,
        name: OWNER.name,
        avatar_url: OWNER.avatarUrl,
        email: OWNER.email,
        github_username: OWNER.githubUsername,
        company: "Polychat",
        site: "https://nicholasgriffin.co.uk",
        location: "London, UK",
        bio: "Building Polychat. This account is the seeded admin.",
        role: "admin",
        created_at: at({ days: 400 }),
        updated_at: at({ minutes: 5 }),
        setup_at: at({ days: 400 }),
        terms_accepted_at: at({ days: 400 }),
        plan_id: "pro",
        message_count: 184,
        last_active_at: at({ minutes: 5 }),
      },
      { replace: true },
    ),
    insert("oauth_account", {
      provider_id: "github",
      provider_user_id: OWNER.githubId,
      user_id: OWNER.id,
    }),
    insert("session", {
      id: sha256Base64Url(SESSION_TOKEN),
      user_id: OWNER.id,
      expires_at: "2099-01-01T00:00:00.000Z",
    }),
    insert("user_settings", {
      id: seedId("settings", "owner"),
      user_id: OWNER.id,
      nickname: "Nick",
      job_role: "Founder and engineer",
      traits: "Direct, dry British humour, prefers short answers with the trade-offs stated.",
      preferences: "Use British English. Prefer bullet points. Never use exclamation marks.",
      memories_save_enabled: true,
      memories_chat_history_enabled: true,
      memory_provider: "built-in",
      search_provider: "tavily",
      default_model_tier: "high",
      default_model_id: SEED_MODEL,
      default_compute_site: "hosted",
      pet_source: "preset",
      pet_id: "pip",
      pet_travel_enabled: true,
      pet_animation_enabled: true,
      onboarding_seen: ["model-sources:web", "welcome", "work-intro"],
      tracking_enabled: false,
      advertise_machines: true,
      last_model_selection: {
        modelId: SEED_MODEL,
        name: "GPT-OSS 120B",
        provider: "workers-ai",
        computeSite: "hosted",
        locationLabel: "Polychat cloud",
      },
      ...encryptionColumns(keys),
      created_at: at({ days: 400 }),
      updated_at: at({ days: 1 }),
    }),
    insert(
      "user_api_keys",
      Object.fromEntries([
        ["id", seedId("apikey", "debug")],
        ["user_id", OWNER.id],
        ["api_key", REVEAL_UNAVAILABLE],
        ["hashed_key", sha256Hex(API_KEY)],
        ["name", "Seed debugging key"],
        ["created_at", at({ days: 30 })],
        ["updated_at", at({ days: 30 })],
      ]),
    ),
    insert("task_notification_preference", {
      user_id: OWNER.id,
      enabled: true,
      decisions: true,
      failures: true,
      completions: true,
      assignments: true,
      updated_at: at({ days: 12 }),
    }),
  );

  for (const provider of ["openai", "anthropic", "google-ai-studio", "mistral"]) {
    statements.push(
      insert("provider_settings", {
        id: seedId("provider", provider),
        provider_id: provider,
        user_id: OWNER.id,
        enabled: provider === "openai",
        created_at: at({ days: 200 }),
        updated_at: at({ days: 3 }),
      }),
    );
  }

  for (const colleague of COLLEAGUES) {
    statements.push(
      insert("user", {
        id: colleague.id,
        name: colleague.name,
        email: colleague.email,
        role: "user",
        created_at: at({ days: 120 }),
        updated_at: at({ days: 2 }),
        setup_at: at({ days: 120 }),
        terms_accepted_at: at({ days: 120 }),
        plan_id: colleague.role === "admin" ? "pro" : "free",
        message_count: 12,
        last_active_at: at({ hours: 6 }),
      }),
      insert("user_settings", {
        id: seedId("settings", String(colleague.id)),
        user_id: colleague.id,
        nickname: colleague.nickname,
        job_role: colleague.jobRole,
        onboarding_seen: ["model-sources:web"],
        created_at: at({ days: 120 }),
        updated_at: at({ days: 2 }),
      }),
    );
  }

  const currentPeriod = period();

  statements.push(
    insert("usage_balance", {
      id: `${OWNER.id}:${currentPeriod}`,
      user_id: OWNER.id,
      period: currentPeriod,
      plan_id: "pro",
      included_credit_micros: credits(1500),
      grace_credit_micros: credits(150),
      spent_credit_micros: credits(212.4),
      reserved_credit_micros: credits(3.5),
      overrun_credit_micros: 0,
      overage_credit_micros: 0,
      overage_enabled: true,
      last_event_at: at({ minutes: 20 }),
      created_at: at({ days: 8 }),
      updated_at: at({ minutes: 20 }),
    }),
  );

  statements.push(...machineStatements(currentPeriod));

  return statements;
}

export function usageStatements() {
  const statements = [];
  const currentPeriod = period();
  const ledger = [
    ["model", "workers-ai", SEED_MODEL, "tokens", 42_000, 3.1, 0.31],
    ["model", "openai", "gpt-5", "tokens", 18_500, 12.4, 1.24],
    ["model", "anthropic", "claude-sonnet-5", "tokens", 9_800, 8.2, 0.82, true],
    ["hosted_tool", "tavily", "web_search", "requests", 14, 2.8, 0.28],
    ["capability", "replicate", "black-forest-labs/flux-2-pro", "images", 3, 15, 1.5],
    ["capability", "parallel", "research", "runs", 1, 40, 4],
    ["infrastructure", "cloudflare", "sandbox", "seconds", 3_600, 60, 6, false, "project"],
    ["model", "workers-ai", SEED_MODEL, "tokens", 12_000, 0.9, 0.09, false, "project"],
    ["capability", "elevenlabs", "speech", "characters", 5_200, 4.6, 0.46],
    ["hosted_tool", "openweathermap", "weather", "requests", 6, 0.3, 0.03],
    ["model", "google-ai-studio", "gemini-3-pro", "tokens", 22_000, 6.5, 0.65],
    ["infrastructure", "cloudflare", "durable-objects", "requests", 91_000, 1.1, 0.11],
  ];

  ledger.forEach(
    ([source, vendor, resource, unit, quantity, creditAmount, costUsd, byok, scope], index) => {
      statements.push(
        insert("usage_event", {
          id: seedId("usage", String(index + 1)),
          idempotency_key: seedId("usage-key", String(index + 1)),
          user_id: OWNER.id,
          workspace_id: scope === "project" ? seedId("workspace", "northstar") : null,
          project_id: scope === "project" ? seedId("project", "autumn-launch") : null,
          occurred_at: at({ days: index % 6, hours: index }),
          period: currentPeriod,
          source,
          vendor,
          resource,
          unit,
          quantity,
          cost_micros: Math.round(costUsd * 1_000_000),
          credit_micros: credits(creditAmount),
          billable: !byok,
          byok: Boolean(byok),
          estimated: false,
          site: "hosted",
        }),
      );
    },
  );

  return statements;
}

function machineStatements(currentPeriod) {
  const statements = [];

  statements.push(
    insert("machine", {
      user_id: OWNER.id,
      machine_id: MACHINE_ID,
      label: "Nick's MacBook Pro",
      platform: "macos",
      app_version: "0.2.0",
      runtimes: [
        {
          kind: "model",
          vendor: "ollama",
          readiness: {
            status: "ready",
            checkedAt: at({ minutes: 2 }),
            version: "0.12.0",
            detail: null,
          },
          models: [
            {
              nativeId: "llama3.3:70b",
              displayName: "Llama 3.3 70B",
              contextTokens: 131072,
              parameterSizeBytes: 42_000_000_000,
              capabilities: { tools: true, vision: false, thinking: false },
              loaded: true,
            },
            {
              nativeId: "qwen3:8b",
              displayName: "Qwen3 8B",
              contextTokens: 32768,
              parameterSizeBytes: 5_000_000_000,
              capabilities: { tools: false, vision: false, thinking: true },
              loaded: false,
            },
          ],
        },
      ],
      capabilities: ["model-run", "agent-run", "handoff", "model-relay"],
      last_seen_at: at({ minutes: 2 }),
      created_at: at({ days: 40 }),
      updated_at: at({ minutes: 2 }),
    }),
    insert("capability_configuration", {
      id: seedId("capability-config", "mcp"),
      scope_type: "user",
      scope_id: String(OWNER.id),
      capability_kind: "tool",
      capability_id: "mcp",
      configuration: JSON.stringify({
        servers: [{ label: "Local docs", url: "http://localhost:8790/mcp" }],
      }),
      created_at: at({ days: 20 }),
      updated_at: at({ days: 20 }),
    }),
  );

  for (const ip of LOCAL_IPS) {
    const hashed = sha256Hex(ip);

    statements.push(
      insert("anonymous_user", {
        id: hashed.slice(0, 36),
        ip_address: hashed,
        user_agent: "Seeded local browser",
        credit_period: currentPeriod,
        spent_credit_micros: credits(4),
        created_at: at({ days: 3 }),
        updated_at: at({ hours: 1 }),
        last_active_at: at({ hours: 1 }),
      }),
    );
  }

  return statements;
}

export function teammateStatements() {
  const statements = [];
  const editor = seedId("teammate", "editor");
  const releaseBot = seedId("teammate", "release-bot");
  const researcher = seedId("teammate", "researcher");

  statements.push(
    insert("teammates", {
      id: editor,
      user_id: OWNER.id,
      name: "Editor",
      description: "Tightens prose, keeps your voice, flags weak claims.",
      servers: [],
      model: SEED_MODEL,
      temperature: "0.4",
      max_steps: 6,
      system_prompt:
        "You are a ruthless but kind editor. Retain the author's voice, cut filler, lead with the problem, and mark any claim that needs a source.",
      few_shot_examples: [
        {
          input: "We are very excited to announce our new feature.",
          output: "We shipped scheduled runs. Here is why it matters.",
        },
      ],
      enabled_tools: ["web_search"],
      mode: "chat",
      kind: "colleague",
      created_at: at({ days: 90 }),
      updated_at: at({ days: 4 }),
    }),
    insert("teammates", {
      id: researcher,
      user_id: OWNER.id,
      name: "Researcher",
      description: "Runs deep research and returns cited briefs.",
      servers: [],
      model: SEED_MODEL,
      temperature: "0.2",
      max_steps: 12,
      system_prompt:
        "Research carefully, cite every claim, separate facts from inference, and end with open questions.",
      enabled_tools: ["web_search", "research"],
      mode: "explore",
      kind: "colleague",
      created_at: at({ days: 60 }),
      updated_at: at({ days: 6 }),
    }),
    insert("teammates", {
      id: releaseBot,
      user_id: OWNER.id,
      owner_scope_type: "workspace",
      owner_scope_id: seedId("workspace", "northstar"),
      name: "Release bot",
      description: "Workspace bot that reviews branches and drafts release notes.",
      servers: [],
      model: SEED_MODEL,
      temperature: "0.1",
      max_steps: 20,
      system_prompt:
        "You operate inside the Northstar workspace. Review the diff, run the quality gate, and write release notes in the changelog style.",
      enabled_tools: ["sandbox", "web_search"],
      mode: "build",
      kind: "bot",
      workspace_default: true,
      created_at: at({ days: 30 }),
      updated_at: at({ days: 1 }),
    }),
    insert("shared_teammates", {
      id: seedId("shared-teammate", "editor"),
      teammate_id: editor,
      user_id: OWNER.id,
      name: "Editor",
      description: "Tightens prose, keeps your voice, flags weak claims.",
      category: "writing",
      tags: ["editing", "writing"],
      is_featured: true,
      is_public: true,
      usage_count: 37,
      rating_count: 9,
      rating_average: "4.6",
      template_data: {
        name: "Editor",
        description: "Tightens prose, keeps your voice, flags weak claims.",
        system_prompt:
          "You are a ruthless but kind editor. Retain the author's voice, cut filler, lead with the problem, and mark any claim that needs a source.",
        model: SEED_MODEL,
        temperature: "0.4",
        enabled_tools: ["web_search"],
        servers: [],
      },
      created_at: at({ days: 80 }),
      updated_at: at({ days: 10 }),
    }),
  );

  return { statements, editor, researcher, releaseBot };
}

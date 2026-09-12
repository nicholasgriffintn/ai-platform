import { OWNER } from "./identity.mjs";
import { at, insert, seedId, SEED_MODEL, sqlValue } from "./sql.mjs";
import { buildThread } from "./thread.mjs";
import { LAUNCH_PROJECT_ID } from "./work.mjs";

const GITHUB_OPERATIONS = [
  "GITHUB_GET_A_PULL_REQUEST",
  "GITHUB_CREATE_A_REVIEW_COMMENT_FOR_A_PULL_REQUEST",
  "GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST",
];

function memoryDocument(statements, { id, scopeType, scopeId, kind, name, content, createdAt }) {
  statements.push(
    insert("memory_document", {
      id,
      scope_type: scopeType,
      scope_id: scopeId,
      kind,
      name,
      content,
      revision: 1,
      created_by: OWNER.id,
      created_at: createdAt,
      updated_at: at({ hours: 1 }),
    }),
    insert("memory_document_revision", {
      id: `${id}-r1`,
      document_id: id,
      revision: 1,
      content,
      change_note: "Seeded",
      operation_id: `seed:${id}`,
      created_by: OWNER.id,
      created_at: createdAt,
    }),
  );
}

function resolvedConfiguration({
  teammateId,
  behaviour,
  invocation,
  mode,
  enabledTools,
  memoryBindings,
  connectionGrants = [],
  maxSteps,
  usedSteps,
}) {
  return {
    teammateId,
    behaviour,
    invocation,
    persona: {},
    model: SEED_MODEL,
    mode,
    skillIds: [],
    enabledTools,
    memoryBindings,
    mcpServers: [],
    connectionGrants,
    maxSteps,
    usedSteps,
  };
}

export function continuityStatements({ teammates, chat, work }) {
  const statements = [];
  const researcherHome = buildThread(
    {
      id: seedId("chat", "teammate-researcher-home"),
      userId: OWNER.id,
      title: "Researcher",
      createdAt: at({ days: 12 }),
    },
    [
      {
        role: "user",
        content:
          "Keep primary sources separate from interpretation and leave open questions visible.",
      },
      {
        role: "assistant",
        mode: "teammate",
        content:
          "Understood. I will preserve source links, label inference, and carry unresolved questions into later work.",
      },
    ],
  );
  const releaseBotHome = buildThread(
    {
      id: seedId("work", "teammate-release-bot-home"),
      userId: OWNER.id,
      title: "Release bot",
      type: "chat",
      projectId: LAUNCH_PROJECT_ID,
      createdAt: at({ days: 10 }),
    },
    [
      {
        role: "assistant",
        mode: "teammate",
        content:
          "I am attached to Autumn launch. Pull-request reviews and the weekly digest will return here.",
        data: {
          teammateActivity: {
            type: "routine",
            recipeTitle: "Review new pull requests",
            summary: "Ready for the next pull request.",
            status: "completed",
          },
        },
      },
    ],
  );

  statements.push(...researcherHome.statements, ...releaseBotHome.statements);

  const homes = {
    editor: chat.conversationIds.editorHome,
    researcher: researcherHome.conversationId,
    releaseBot: releaseBotHome.conversationId,
  };
  const contextDocuments = {
    editor: seedId("teammate-memory", "editor-personal"),
    researcher: seedId("teammate-memory", "researcher-personal"),
    releaseBot: seedId("teammate-memory", "release-bot-launch"),
  };
  const contextContent = {
    editor:
      "# Working context\n\n- Preserve the author's voice.\n- Cut filler before polishing sentences.\n- Flag claims that need sources.",
    researcher:
      "# Working context\n\n- Prefer primary sources.\n- Separate evidence from inference.\n- Keep unresolved questions visible across runs.",
    releaseBot:
      "# Working context\n\n- Work only in Autumn launch.\n- Review the diff before drafting release notes.\n- Never merge or push directly to main.",
  };

  for (const key of ["editor", "researcher", "releaseBot"]) {
    memoryDocument(statements, {
      id: contextDocuments[key],
      scopeType: "personal",
      scopeId: String(OWNER.id),
      kind: "teammate_context",
      name: `teammate-context-${key.toLowerCase()}`,
      content: contextContent[key],
      createdAt: at({ days: 10 }),
    });

    statements.push(
      insert("teammate_context", {
        id: teammates.contexts[key],
        teammate_id: teammates[key],
        actor_user_id: OWNER.id,
        scope_type: key === "releaseBot" ? "project" : "personal",
        scope_id: key === "releaseBot" ? LAUNCH_PROJECT_ID : String(OWNER.id),
        home_conversation_id: homes[key],
        memory_document_id: contextDocuments[key],
        status: "active",
        created_at: at({ days: 10 }),
        updated_at: at({ hours: 1 }),
      }),
      insert("teammate_computer", {
        id: seedId("teammate-computer", key.toLowerCase()),
        context_id: teammates.contexts[key],
        provider: "hosted",
        provider_handle: null,
        checkpoint_reference: null,
        status: "stopped",
        lease_kind: null,
        lease_owner_id: null,
        lease_expires_at: null,
        lease_fence: 0,
        created_at: at({ days: 10 }),
        updated_at: at({ hours: 1 }),
      }),
    );
  }

  const releaseGrant = {
    id: seedId("teammate-grant", "release-bot-github"),
    connectionId: seedId("connection", "github-teammate"),
    revision: 1,
    allowedOperations: GITHUB_OPERATIONS,
  };

  statements.push(
    insert("teammate_connection_grant", {
      id: releaseGrant.id,
      context_id: teammates.contexts.releaseBot,
      connection_id: releaseGrant.connectionId,
      allowed_operations: releaseGrant.allowedOperations,
      revision: releaseGrant.revision,
      created_at: at({ days: 9 }),
      updated_at: at({ days: 2 }),
    }),
  );

  const briefTargets = [
    {
      key: "delegation-parent",
      conversationId: chat.conversationIds.delegation,
      scopeType: "personal",
      scopeId: String(OWNER.id),
      content:
        "# Objective\n\nCoordinate a sourced article on WebSocket back-pressure.\n\n# Constraints\n\nWait for both delegated pieces before synthesising.\n\n# Decisions\n\nResearcher gathers sources; Editor drafts the opening.\n\n# Sources and outputs\n\nResearch output is attached to the completed delegation.\n\n# Unfinished work\n\nEditor introduction is still running.",
    },
    {
      key: "delegate-researcher",
      conversationId: seedId("chat", "delegate-researcher"),
      scopeType: "personal",
      scopeId: String(OWNER.id),
      content:
        "# Objective\n\nGather primary sources on WebSocket back-pressure.\n\n# Constraints\n\nOne line per source and distinguish browser from server behaviour.\n\n# Decisions\n\nUse bufferedAmount as the browser-side signal.\n\n# Sources and outputs\n\nSeven-source document completed.\n\n# Unfinished work\n\nNone.",
    },
    {
      key: "delegate-editor",
      conversationId: seedId("chat", "delegate-editor"),
      scopeType: "personal",
      scopeId: String(OWNER.id),
      content:
        "# Objective\n\nDraft a 120-word introduction on WebSocket back-pressure.\n\n# Constraints\n\nLead with the operational problem and avoid generic claims.\n\n# Decisions\n\nOpen with the promise implicit in every socket.\n\n# Sources and outputs\n\nResearcher output is available from the parent thread.\n\n# Unfinished work\n\nComplete and return the draft.",
    },
    {
      key: "editor-home",
      conversationId: homes.editor,
      scopeType: "personal",
      scopeId: String(OWNER.id),
      content:
        "# Objective\n\nImprove product prose without losing the author's voice.\n\n# Constraints\n\nBritish English; no filler.\n\n# Decisions\n\nStart with the shipped change and the problem it removes.\n\n# Sources and outputs\n\nNo external sources required.\n\n# Unfinished work\n\nNone.",
    },
    {
      key: "work-running",
      conversationId: work.conversationIds.running,
      scopeType: "project",
      scopeId: LAUNCH_PROJECT_ID,
      content:
        "# Objective\n\nAdd bounded exponential backoff to the shared fetch helper.\n\n# Constraints\n\nReuse the shared helper and run the project quality gate.\n\n# Decisions\n\nRetry transient network failures only.\n\n# Sources and outputs\n\nSandbox plan and current branch are attached.\n\n# Unfinished work\n\nFinish implementation and validation.",
    },
  ];
  const briefIds = {};

  for (const target of briefTargets) {
    const id = seedId("conversation-brief", target.key);

    briefIds[target.key] = id;
    memoryDocument(statements, {
      id,
      scopeType: target.scopeType,
      scopeId: target.scopeId,
      kind: "conversation_brief",
      name: `conversation-brief-${target.key}`,
      content: target.content,
      createdAt: at({ hours: 3 }),
    });
    statements.push(
      `UPDATE "conversation" SET "brief_document_id" = ${sqlValue(id)} WHERE "id" = ${sqlValue(target.conversationId)};`,
    );
  }

  const delegationRuns = [
    {
      kind: "researcher",
      contextId: teammates.contexts.researcher,
      teammateId: teammates.researcher,
      conversationId: seedId("chat", "delegate-researcher"),
      mode: "explore",
      enabledTools: ["web_search", "research"],
      maxSteps: 12,
      usedSteps: 5,
      memoryBindings: [
        { documentId: briefIds["delegation-parent"], access: "read" },
        { documentId: briefIds["delegate-researcher"], access: "read-write" },
      ],
    },
    {
      kind: "editor",
      contextId: teammates.contexts.editor,
      teammateId: teammates.editor,
      conversationId: seedId("chat", "delegate-editor"),
      mode: "chat",
      enabledTools: ["web_search"],
      maxSteps: 6,
      usedSteps: 1,
      memoryBindings: [
        { documentId: briefIds["delegation-parent"], access: "read" },
        { documentId: briefIds["delegate-editor"], access: "read-write" },
      ],
    },
  ];

  for (const run of delegationRuns) {
    const configuration = resolvedConfiguration({
      teammateId: run.teammateId,
      behaviour: "colleague",
      invocation: {
        source: "delegation",
        delegationId: seedId("delegation", run.kind),
      },
      mode: run.mode,
      enabledTools: run.enabledTools,
      memoryBindings: run.memoryBindings,
      maxSteps: run.maxSteps,
      usedSteps: run.usedSteps,
    });

    statements.push(
      `UPDATE "delegation" SET "memory_bindings_json" = ${sqlValue(run.memoryBindings)}, "continuation_mode" = 'new' WHERE "id" = ${sqlValue(seedId("delegation", run.kind))};`,
      `UPDATE "conversation_run" SET "teammate_context_id" = ${sqlValue(run.contextId)}, "computer_id" = ${sqlValue(seedId("teammate-computer", run.kind))}, "resolved_configuration_json" = ${sqlValue(configuration)} WHERE "id" = ${sqlValue(`${run.conversationId}-run`)};`,
    );
  }

  const editorHomeConfiguration = resolvedConfiguration({
    teammateId: teammates.editor,
    behaviour: "colleague",
    invocation: { source: "conversation", conversationId: homes.editor },
    mode: "chat",
    enabledTools: ["web_search"],
    memoryBindings: [],
    maxSteps: 6,
    usedSteps: 2,
  });

  statements.push(
    `UPDATE "conversation_run" SET "teammate_context_id" = ${sqlValue(teammates.contexts.editor)}, "computer_id" = ${sqlValue(seedId("teammate-computer", "editor"))}, "resolved_configuration_json" = ${sqlValue(editorHomeConfiguration)} WHERE "id" = ${sqlValue(`${homes.editor}-run`)};`,
  );

  const computerTakeoverConfiguration = resolvedConfiguration({
    teammateId: teammates.editor,
    behaviour: "colleague",
    invocation: {
      source: "conversation",
      conversationId: chat.conversationIds.computerTakeover,
    },
    mode: "chat",
    enabledTools: ["use_computer"],
    memoryBindings: [],
    maxSteps: 6,
    usedSteps: 1,
  });

  statements.push(
    `UPDATE "conversation_run" SET "teammate_context_id" = ${sqlValue(teammates.contexts.editor)}, "computer_id" = ${sqlValue(seedId("teammate-computer", "editor"))}, "resolved_configuration_json" = ${sqlValue(computerTakeoverConfiguration)} WHERE "id" = ${sqlValue(`${chat.conversationIds.computerTakeover}-run`)};`,
  );

  return statements;
}

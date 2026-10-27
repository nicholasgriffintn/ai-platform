import { COLLEAGUES, OWNER } from "./identity.mjs";
import {
  ahead,
  at,
  encryptWithServerKey,
  insert,
  NOW,
  seedId,
  SEED_MODEL,
  sha256Hex,
  sqlValue,
} from "./sql.mjs";
import { buildThread, toolCall } from "./thread.mjs";
import { INITIATIVES, PROJECTS, taskId, WORKSPACE_ID, workContextId } from "./work-ids.mjs";
import { workTaskStatements } from "./work-tasks.mjs";
import { MISSION, workTeamStatements } from "./work-team.mjs";

export const LAUNCH_PROJECT_ID = PROJECTS.launch;
const WEBSITE_PROJECT_ID = PROJECTS.website;
const ARCHIVED_PROJECT_ID = PROJECTS.pilot;
const REPOSITORY = "nicholasgriffintn/ai-platform-sandbox-worker-tester";
const USAGE = {
  prompt_tokens: 1500,
  completion_tokens: 620,
  total_tokens: 2120,
  cost_usd: 0.004,
};

const FLOW = {
  stages: [
    {
      id: "plan",
      name: "Plan",
      instructions: "Write the approach before touching code.",
      teammateId: null,
      skillIds: [],
      mode: "plan",
      requiresApprovalFor: [],
      advance: "on_goal_complete",
    },
    {
      id: "build",
      name: "Build",
      instructions: "Implement with tests.",
      teammateId: seedId("teammate", "release-bot"),
      skillIds: [],
      mode: "build",
      requiresApprovalFor: ["write", "sandbox"],
      advance: "on_goal_complete",
    },
    {
      id: "review",
      name: "Review",
      instructions: "A human accepts the result.",
      teammateId: null,
      skillIds: [],
      mode: null,
      requiresApprovalFor: [],
      advance: "on_human_accept",
    },
  ],
};

const DELIVERY_POLICY = { mode: "review_branch", destination: "pull_request" };

function audit(statements, action, targetType, targetId, actorUserId, createdAt, metadata = {}) {
  statements.push(
    insert("workspace_audit_record", {
      id: seedId("audit", sha256Hex(`${action}:${targetId}:${createdAt}`).slice(0, 12)),
      workspace_id: WORKSPACE_ID,
      actor_user_id: actorUserId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
      created_at: createdAt,
    }),
  );
}

function sandboxRunData({
  runId,
  task,
  status,
  phase,
  startedAt,
  completedAt,
  success,
  summary,
  files,
  checks,
  pullRequest,
  events,
  inspection,
}) {
  const base = {
    runId,
    projectId: LAUNCH_PROJECT_ID,
    installationId: 987654,
    repo: REPOSITORY,
    task,
    taskType: "feature-implementation",
    model: SEED_MODEL,
    trustLevel: "balanced",
    promptStrategy: "auto",
    deliveryPolicy: DELIVERY_POLICY,
    shouldCommit: true,
    environmentSetup: { source: "repository" },
    environmentPreparationMode: "setup",
    status,
    startedAt,
    updatedAt: completedAt ?? startedAt,
    workflowPhase: phase,
    timeoutSeconds: 900,
    inspectionWindowSeconds: inspection ?? 0,
    events,
  };

  if (!completedAt) {
    return base;
  }

  const validation = {
    qualityGate: checks.every((check) => check.status === "passed") ? "passed" : "failed",
    checks,
  };
  const delivery = pullRequest
    ? {
        policy: DELIVERY_POLICY,
        branch: pullRequest.branch,
        commit: pullRequest.commit,
        pullRequestUrl: pullRequest.url,
      }
    : { policy: DELIVERY_POLICY };

  return {
    ...base,
    completedAt,
    result: {
      success,
      summary,
      diff: files
        .map(
          (file) =>
            `diff --git a/${file} b/${file}\n+++ b/${file}\n@@ -1 +1 @@\n+// updated by the seed run`,
        )
        .join("\n"),
      logs: checks
        .map((check) => `$ ${check.command}\n${check.status === "passed" ? "ok" : "FAIL"}`)
        .join("\n"),
      branchName: pullRequest?.branch,
      pullRequestUrl: pullRequest?.url,
      proof: {
        repository: {
          baseRevision: "a664f7c9",
          headRevision: pullRequest?.commit ?? "a664f7c9",
        },
        changedFileCount: files.length,
        changedFiles: files,
        validation,
        delivery,
        residualRisks: success ? [] : [summary],
        incompleteWork: success ? [] : ["The run ended before the objective was completed."],
      },
    },
    manifest: {
      version: 1,
      runId,
      objective: task,
      outcome: success
        ? { status, success, summary }
        : { status, success, summary, error: summary },
      timestamps: { startedAt, updatedAt: completedAt, completedAt },
      repository: {
        name: REPOSITORY,
        baseRevision: "a664f7c9",
        headRevision: pullRequest?.commit ?? "a664f7c9",
      },
      changes: { fileCount: files.length, files, filesTruncated: false },
      validation,
      delivery,
      artifacts: [
        {
          outputId: seedId("output", `${runId}-logs`),
          name: "run.log",
          kind: "log",
          contentType: "text/plain",
          sizeBytes: 812,
          url: `/outputs/${seedId("output", `${runId}-logs`)}`,
        },
      ],
      usage: {
        model: { id: SEED_MODEL },
        infrastructure: { instanceType: "standard", durationSeconds: 184 },
      },
      residualRisks: success ? [] : [summary],
      incompleteWork: success ? [] : ["The run ended before the objective was completed."],
    },
    infrastructureUsage: { instanceType: "standard", durationSeconds: 184 },
  };
}

export async function workStatements({ serverKey, teammates }) {
  const statements = [];
  const created = at({ days: 60 });

  statements.push(
    insert("workspace", {
      id: WORKSPACE_ID,
      name: "Northstar Studio",
      description: MISSION,
      colour: "#E8643C",
      created_by: OWNER.id,
      created_at: created,
      updated_at: at({ days: 2 }),
    }),
    insert("resource_grant", {
      kind: "membership",
      workspace_id: WORKSPACE_ID,
      user_id: OWNER.id,
      role: "owner",
      created_at: created,
    }),
  );
  audit(statements, "workspace.created", "workspace", WORKSPACE_ID, OWNER.id, created, {
    name: "Northstar Studio",
  });

  for (const colleague of COLLEAGUES) {
    const joinedAt = at({ days: 50 - (colleague.id % 5) });

    statements.push(
      insert("resource_grant", {
        kind: "membership",
        workspace_id: WORKSPACE_ID,
        user_id: colleague.id,
        role: colleague.role,
        created_at: joinedAt,
      }),
    );
    audit(
      statements,
      "workspace.invitation.accepted",
      "user",
      String(colleague.id),
      colleague.id,
      joinedAt,
      { role: colleague.role },
    );
  }

  statements.push(
    insert("resource_grant", {
      kind: "invitation",
      id: seedId("invitation", "pending"),
      workspace_id: WORKSPACE_ID,
      email: "sam@northstar.example",
      role: "member",
      token_hash: sha256Hex("polychat-seed-invite-sam"),
      status: "pending",
      created_by_user_id: OWNER.id,
      expires_at: ahead({ days: 6 }),
      created_at: at({ days: 1 }),
      updated_at: at({ days: 1 }),
    }),
    insert("resource_grant", {
      kind: "invitation",
      id: seedId("invitation", "revoked"),
      workspace_id: WORKSPACE_ID,
      email: "contractor@example.com",
      role: "member",
      token_hash: sha256Hex("polychat-seed-invite-contractor"),
      status: "revoked",
      created_by_user_id: OWNER.id,
      expires_at: at({ days: 10 }),
      created_at: at({ days: 20 }),
      updated_at: at({ days: 12 }),
    }),
  );
  audit(
    statements,
    "workspace.invitation.created",
    "workspace_invitation",
    seedId("invitation", "pending"),
    OWNER.id,
    at({ days: 1 }),
    { email: "sam@northstar.example" },
  );
  audit(
    statements,
    "workspace.invitation.revoked",
    "workspace_invitation",
    seedId("invitation", "revoked"),
    OWNER.id,
    at({ days: 12 }),
    {},
  );

  statements.push(
    insert("project", {
      id: LAUNCH_PROJECT_ID,
      workspace_id: WORKSPACE_ID,
      name: "Autumn launch",
      description:
        "Ship the September release: scheduled runs, quoted selections and machine handoffs.",
      instructions:
        "Prefer small pull requests. Every change needs a test. Write release notes in the changelog voice.",
      colour: "#2563EB",
      coding_enabled: true,
      coding_installation_id: 987654,
      coding_repository: REPOSITORY,
      coding_prompt_strategy: "feature-delivery",
      coding_should_commit: true,
      coding_timeout_seconds: 900,
      coding_inspection_window_seconds: 120,
      coding_delivery_policy: DELIVERY_POLICY,
      coding_environment_setup: {
        source: "polychat",
        definition: {
          version: 1,
          setupCommands: ["pnpm install --frozen-lockfile"],
          resumeCommands: ["pnpm install --offline"],
          runtimes: [],
          setupTimeoutSeconds: 600,
          environment: ["SENTRY_DSN", "FEATURE_FLAGS"],
        },
      },
      flow: FLOW,
      default_model_tier: "high",
      task_prefix: "LNCH",
      initiative_id: INITIATIVES.release,
      standup: {
        enabled: true,
        time: "09:15",
        days: [1, 2, 3, 4, 5],
        timeZone: "Europe/London",
        questions: ["What did you finish?", "What's next?", "Anything in your way?"],
        participants: "everyone",
        windowMinutes: 180,
        shareBindingId: null,
        pausedUntil: null,
      },
      standup_last_run_at: NOW.toISOString(),
      created_by: OWNER.id,
      created_at: at({ days: 45 }),
      updated_at: at({ days: 1 }),
    }),
    insert("project", {
      id: WEBSITE_PROJECT_ID,
      workspace_id: WORKSPACE_ID,
      name: "Website refresh",
      description: "Marketing site copy and design refresh.",
      instructions: "Keep copy short. British English.",
      colour: "#0F766E",
      task_prefix: "WEB",
      initiative_id: INITIATIVES.growth,
      created_by: 9001,
      created_at: at({ days: 30 }),
      updated_at: at({ days: 5 }),
    }),
    insert("project", {
      id: ARCHIVED_PROJECT_ID,
      workspace_id: WORKSPACE_ID,
      name: "Pilot",
      description: "The original pilot project, archived after launch.",
      colour: "#6B7280",
      task_prefix: "PIL",
      created_by: OWNER.id,
      archived_at: at({ days: 14 }),
      created_at: at({ days: 58 }),
      updated_at: at({ days: 14 }),
    }),
    insert("project", {
      id: PROJECTS.support,
      workspace_id: WORKSPACE_ID,
      name: "Support desk",
      description: "Customer questions from email, with drafted replies and help articles.",
      instructions: "Reply within a day. Never send to a customer without approval.",
      colour: "#7C3AED",
      task_prefix: "SUP",
      initiative_id: INITIATIVES.support,
      created_by: OWNER.id,
      created_at: at({ days: 20 }),
      updated_at: at({ hours: 1 }),
    }),
    insert("project", {
      id: PROJECTS.company,
      workspace_id: WORKSPACE_ID,
      name: "Company",
      description: "Where the lead sets up the workspace, writes briefs and reviews initiatives.",
      colour: "#B45309",
      task_prefix: "CO",
      created_by: OWNER.id,
      created_at: at({ days: 21 }),
      updated_at: at({ hours: 6 }),
    }),
  );
  audit(statements, "project.created", "project", LAUNCH_PROJECT_ID, OWNER.id, at({ days: 45 }), {
    name: "Autumn launch",
  });
  audit(statements, "project.created", "project", WEBSITE_PROJECT_ID, 9001, at({ days: 30 }), {
    name: "Website refresh",
  });
  audit(
    statements,
    "project.archived",
    "project",
    ARCHIVED_PROJECT_ID,
    OWNER.id,
    at({ days: 14 }),
    {},
  );

  statements.push(
    insert("scoped_configuration", {
      kind: "capability",
      attached: true,
      id: seedId("capability", "release-bot"),
      project_id: LAUNCH_PROJECT_ID,
      target_kind: "teammate",
      target_id: teammates.releaseBot,
      created_by: OWNER.id,
      created_at: at({ days: 30 }),
    }),
    insert("scoped_configuration", {
      kind: "capability",
      attached: true,
      id: seedId("capability", "no-image-gen"),
      project_id: LAUNCH_PROJECT_ID,
      target_kind: "tool",
      target_id: "image_generation",
      excluded: true,
      created_by: OWNER.id,
      created_at: at({ days: 30 }),
    }),
    insert("scoped_configuration", {
      kind: "capability",
      attached: true,
      id: seedId("capability", "github-recipe"),
      project_id: LAUNCH_PROJECT_ID,
      target_kind: "recipe",
      target_id: "github-pull-request-review",
      payload: { reviewers: ["nicholasgriffintn"] },
      created_by: OWNER.id,
      created_at: at({ days: 20 }),
    }),
    insert("template", {
      id: seedId("template", "pr-review"),
      created_by_user_id: OWNER.id,
      workspace_id: WORKSPACE_ID,
      project_id: LAUNCH_PROJECT_ID,
      kind: "recipe",
      capability_id: "github-pull-request-review",
      name: "Review new pull requests",
      description:
        "When a pull request opens, the Release bot reviews it and leaves a summary comment.",
      configuration: {
        recipeId: "github-pull-request-review",
        status: "active",
        triggers: [{ id: "pull-request-opened", type: "manual", enabled: true }],
        configuration: { reviewers: ["nicholasgriffintn"] },
        teammateContextId: teammates.contexts.releaseBot,
      },
      status: "active",
      created_at: at({ days: 20 }),
      updated_at: at({ days: 20 }),
    }),
    insert("template", {
      id: seedId("template", "weekly-digest"),
      created_by_user_id: OWNER.id,
      workspace_id: WORKSPACE_ID,
      project_id: LAUNCH_PROJECT_ID,
      kind: "recipe",
      capability_id: "weekly-digest",
      name: "Weekly digest",
      description: "Every Monday summarise the week's tasks into the project memory.",
      configuration: {
        recipeId: "weekly-digest",
        status: "paused",
        triggers: [
          {
            id: "monday-digest",
            type: "schedule",
            enabled: false,
            cronExpression: "0 9 * * 1",
            timezone: "Europe/London",
          },
        ],
        configuration: {},
        teammateContextId: teammates.contexts.releaseBot,
      },
      status: "paused",
      created_at: at({ days: 25 }),
      updated_at: at({ days: 3 }),
    }),
    insert("provider_connection", {
      id: seedId("connection", "github"),
      user_id: OWNER.id,
      provider: "github",
      kind: "app_installation",
      external_id: "987654",
      status: "connected",
      encrypted_data: { installationId: 987654, account: "nicholasgriffintn" },
      metadata: {
        repositories: [REPOSITORY],
        permissions: ["contents", "pull_requests"],
      },
      created_at: at({ days: 44 }),
      updated_at: at({ days: 2 }),
    }),
    insert("provider_connection", {
      id: seedId("connection", "github-teammate"),
      user_id: OWNER.id,
      provider: "github",
      kind: "recipe_connector_account",
      external_id: "acct_seed_github",
      status: "connected",
      encrypted_data: {},
      metadata: {
        authConfigId: "ac_2Brv6Z938Ypv",
        status: "ACTIVE",
        isDisabled: false,
        alias: "Northstar GitHub",
      },
      created_at: at({ days: 20 }),
      updated_at: at({ days: 2 }),
    }),
    insert("channel_binding", {
      id: seedId("channel", "slack-launch"),
      channel: "slack",
      scope_type: "project",
      scope_id: LAUNCH_PROJECT_ID,
      external_id: "C0SEEDLAUNCH",
      label: "#autumn-launch",
      teammate_id: teammates.releaseBot,
      interaction_mode: "automated",
      created_by: OWNER.id,
      enabled: true,
      created_at: at({ days: 18 }),
    }),
  );
  audit(
    statements,
    "project.capability.added",
    "project_capability",
    seedId("capability", "release-bot"),
    OWNER.id,
    at({ days: 30 }),
    { kind: "teammate" },
  );

  if (serverKey) {
    for (const [name, value] of [
      ["SENTRY_DSN", "https://seed@sentry.example/1"],
      ["FEATURE_FLAGS", "quoted-selections,scheduled-runs"],
    ]) {
      statements.push(
        insert("scoped_configuration", {
          kind: "environment",
          id: seedId("env", name.toLowerCase()),
          project_id: LAUNCH_PROJECT_ID,
          target_id: name,
          encrypted_value: await encryptWithServerKey(serverKey, value),
          created_at: at({ days: 12 }),
          updated_at: at({ days: 12 }),
        }),
      );
    }
  }

  for (const [name, content] of [
    [
      "decisions",
      "# Decisions\n\n- Delivery policy is review branch plus pull request. Nobody commits to main.\n- Inspection windows are capped at two minutes.\n- The Release bot owns release notes.",
    ],
    [
      "glossary",
      "# Glossary\n\n- **Handoff**: moving a run from hosted to a machine.\n- **Quality gate**: typecheck and tests inside the sandbox.",
    ],
  ]) {
    const documentId = seedId("project-memory", name);

    statements.push(
      insert("resource", {
        resource_type: "memory",
        kind: "memory",
        id: documentId,
        scope_type: "project",
        scope_id: LAUNCH_PROJECT_ID,
        title: name,
        content,
        revision: 1,
        created_by_user_id: OWNER.id,
        created_at: at({ days: 20 }),
        updated_at: at({ days: 4 }),
      }),
      insert("resource_revision", {
        resource_type: "memory",
        id: `${documentId}-r1`,
        document_id: documentId,
        revision: 1,
        text_content: content,
        change_note: "Seeded",
        created_by: OWNER.id,
        created_at: at({ days: 20 }),
      }),
    );
  }

  const projectGroup = seedId("group", "launch-threads");

  statements.push(
    insert("resource_collection", {
      collection_type: "conversation",
      id: projectGroup,
      project_id: LAUNCH_PROJECT_ID,
      title: "Launch threads",
      normalised_name: "launch threads",
      created_by_user_id: OWNER.id,
      created_at: at({ days: 10 }),
    }),
  );

  const runningThread = buildThread(
    {
      userId: OWNER.id,
      id: seedId("work", "retry-helper"),
      title: "Add retries to the fetch helper",
      type: "task",
      projectId: LAUNCH_PROJECT_ID,
      createdAt: at({ hours: 4 }),
      run: {
        status: "running",
        projectTaskId: taskId("launch", 3),
        stageId: "build",
        teammateContextId: workContextId("release-bot"),
        trigger: "handle",
      },
    },
    [
      {
        role: "user",
        content:
          "Add retries with exponential backoff to the shared fetch helper. Cover it with tests.",
      },
      ...toolCall({
        name: "sandbox",
        callId: "call_sandbox_plan",
        input: { action: "plan", objective: "Add retries to the fetch helper" },
        result:
          "Plan: 1. Read src/lib/fetch.ts 2. Add retry wrapper 3. Add tests 4. Run quality gate",
        data: {
          responseType: "custom",
          renderer: "sandbox_plan",
          icon: "list-checks",
          formattedName: "Sandbox plan",
          data: {
            steps: [
              "Read src/lib/fetch.ts",
              "Add retry wrapper with backoff",
              "Add tests",
              "Run quality gate",
            ],
          },
        },
      }),
      {
        role: "tool",
        name: "sandbox",
        toolCallId: "call_sandbox_event",
        content: "Running pnpm test",
        status: "success",
        data: {
          responseType: "custom",
          renderer: "sandbox_event",
          icon: "terminal",
          formattedName: "Sandbox",
          data: {
            type: "command_started",
            command: "pnpm test",
            runId: seedId("run", "retry-helper"),
          },
        },
        model: null,
        provenance: null,
      },
      {
        role: "assistant",
        status: "in_progress",
        content: "Tests are running in the sandbox.",
      },
    ],
  );

  const threadInsertIndex = statements.length;

  statements.push(...runningThread.statements);
  statements.push(
    `UPDATE conversation SET group_id = ${sqlValue(projectGroup)}, group_assigned_by_user_id = ${sqlValue(OWNER.id)}, group_assigned_at = ${sqlValue(at({ hours: 4 }))} WHERE id = ${sqlValue(runningThread.conversationId)};`,
  );

  const doneThread = buildThread(
    {
      userId: OWNER.id,
      id: seedId("work", "unread-badge"),
      title: "Show unread counts in the sidebar",
      type: "task",
      projectId: LAUNCH_PROJECT_ID,
      createdAt: at({ days: 2, hours: 6 }),
      run: {
        status: "succeeded",
        projectTaskId: taskId("launch", 2),
        stageId: "build",
        teammateContextId: workContextId("release-bot"),
        trigger: "handle",
      },
    },
    [
      {
        role: "user",
        content: "Show unread counts next to each conversation group in the sidebar.",
      },
      {
        role: "tool",
        name: "sandbox",
        toolCallId: "call_sandbox_result",
        content: "Run completed. 2 files changed, quality gate passed, pull request opened.",
        status: "success",
        data: {
          responseType: "custom",
          renderer: "sandbox_result",
          icon: "check",
          formattedName: "Sandbox result",
          data: {
            runId: seedId("run", "unread-badge"),
            success: true,
            summary: "Added unread counts to the sidebar groups.",
            pullRequestUrl: `https://github.com/${REPOSITORY}/pull/41`,
            changedFiles: [
              "packages/component-shell/src/Sidebar/GroupRow.tsx",
              "packages/component-shell/src/Sidebar/GroupRow.test.tsx",
            ],
          },
        },
        model: null,
        provenance: null,
      },
      {
        role: "assistant",
        usage: USAGE,
        content:
          "Done. The count comes from the existing unread query, so there is no new endpoint. Pull request 41 is ready for review.",
      },
    ],
  );

  statements.push(...doneThread.statements);

  const failedThread = buildThread(
    {
      userId: 9002,
      id: seedId("work", "flaky-e2e"),
      title: "Fix the flaky onboarding e2e test",
      type: "task",
      projectId: LAUNCH_PROJECT_ID,
      createdAt: at({ days: 1, hours: 3 }),
      run: {
        status: "failed",
        terminalReason: "Polychat API returned an empty completion response",
        projectTaskId: taskId("launch", 5),
        stageId: "build",
        teammateContextId: workContextId("release-bot"),
        trigger: "handle",
      },
    },
    [
      {
        role: "user",
        content: "The onboarding e2e test fails one run in five. Find the race and fix it.",
      },
      {
        role: "assistant",
        status: "error",
        content: "",
        data: { error: "Polychat API returned an empty completion response" },
      },
    ],
  );

  statements.push(...failedThread.statements);

  const runs = [
    {
      key: "unread-badge",
      conversationId: doneThread.conversationId,
      status: "completed",
      activityStatus: "succeeded",
      phase: "completed",
      startedAt: at({ days: 2, hours: 6 }),
      completedAt: at({ days: 2, hours: 5, minutes: 50 }),
      success: true,
      summary: "Added unread counts to the sidebar groups.",
      files: [
        "packages/component-shell/src/Sidebar/GroupRow.tsx",
        "packages/component-shell/src/Sidebar/GroupRow.test.tsx",
      ],
      checks: [
        { command: "pnpm typecheck", status: "passed", exitCode: 0 },
        { command: "pnpm test", status: "passed", exitCode: 0 },
      ],
      pullRequest: {
        branch: "polychat/unread-counts",
        commit: "5f1c2d9",
        url: `https://github.com/${REPOSITORY}/pull/41`,
      },
    },
    {
      key: "flaky-e2e",
      conversationId: failedThread.conversationId,
      status: "failed",
      activityStatus: "failed",
      phase: "failed",
      startedAt: at({ days: 1, hours: 3 }),
      completedAt: at({ days: 1, hours: 2, minutes: 41 }),
      success: false,
      summary: "Polychat API returned an empty completion response",
      files: ["apps/app/tests/e2e/features/onboarding.spec.ts"],
      checks: [
        { command: "pnpm typecheck", status: "passed", exitCode: 0 },
        { command: "pnpm test:e2e onboarding", status: "failed", exitCode: 1 },
      ],
      pullRequest: null,
      userId: 9002,
    },
    {
      key: "retry-helper",
      conversationId: runningThread.conversationId,
      status: "running",
      activityStatus: "running",
      phase: "executing",
      startedAt: at({ hours: 4 }),
      completedAt: null,
      inspection: 120,
    },
  ];

  for (const run of runs) {
    const runId = seedId("run", run.key);
    const events = [
      {
        type: "run_queued",
        runId,
        repo: REPOSITORY,
        timestamp: run.startedAt,
        message: "Run queued for sandbox dispatch",
      },
      {
        type: "command_completed",
        command: "pnpm install --frozen-lockfile",
        exitCode: 0,
        stream: "stdout",
        output: "Done in 41s",
      },
    ];

    if (run.completedAt) {
      events.push(
        ...run.checks.map((check) => ({
          type: "command_completed",
          command: check.command,
          exitCode: check.exitCode,
          stream: check.status === "passed" ? "stdout" : "stderr",
          output: check.status === "passed" ? "ok" : "1 failed",
        })),
      );
    }

    statements.push(
      insert("activity_record", {
        id: seedId("activity", run.key),
        created_by_user_id: run.userId ?? OWNER.id,
        project_id: LAUNCH_PROJECT_ID,
        conversation_id: run.conversationId,
        capability_id: "sandbox_runs",
        group_id: runId,
        kind: "run",
        status: run.activityStatus,
        summary: `${REPOSITORY}: ${run.summary ?? "Add retries to the fetch helper"}`,
        data: sandboxRunData({
          ...run,
          runId,
          task: run.summary ?? "Add retries to the fetch helper",
          events,
        }),
        created_at: run.startedAt,
        updated_at: run.completedAt ?? at({ minutes: 4 }),
      }),
    );

    if (run.completedAt) {
      const outputId = seedId("output", `${runId}-logs`);

      statements.push(
        insert("resource", {
          resource_type: "output",
          id: outputId,
          created_by_user_id: run.userId ?? OWNER.id,
          scope_type: "project",
          scope_id: LAUNCH_PROJECT_ID,
          conversation_id: run.conversationId,
          capability_id: "sandbox",
          group_id: runId,
          kind: "sandbox_artifact",
          title: "run.log",
          status: "ready",
          sensitivity: "internal",
          content: {
            text: run.checks.map((check) => `$ ${check.command}\n${check.status}`).join("\n\n"),
          },
          mime_type: "text/plain",
          filename: "run.log",
          byte_size: 812,
          revision: 1,
          created_at: run.completedAt,
          updated_at: run.completedAt,
        }),
        insert("resource_revision", {
          resource_type: "output",
          output_id: outputId,
          revision: 1,
          title: "run.log",
          status: "ready",
          sensitivity: "internal",
          content: { text: "seeded" },
          created_by_user_id: run.userId ?? OWNER.id,
          created_at: run.completedAt,
          operation: "created",
        }),
      );
    }
  }

  const team = workTeamStatements();
  const work = workTaskStatements({
    flow: FLOW,
    releaseBot: teammates.releaseBot,
    threads: { running: runningThread, done: doneThread, failed: failedThread },
  });

  statements.splice(threadInsertIndex, 0, ...team.statements, ...work.taskStatements);
  statements.push(
    ...work.after,
    ...Object.entries(work.sequences).map(
      ([project, sequence]) =>
        `UPDATE "project" SET "task_sequence" = ${sequence} WHERE "id" = ${sqlValue(PROJECTS[project])};`,
    ),
  );

  return {
    statements,
    conversationIds: {
      running: runningThread.conversationId,
      done: doneThread.conversationId,
    },
  };
}

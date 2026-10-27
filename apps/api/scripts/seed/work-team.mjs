import {
  hireProposalSchema,
  leadRoutinesSchema,
  setupPlanSchema,
  setupPlanStateSchema,
  workWakeRecordSchema,
} from "@ngriffin_uk/polychat-schemas";

import { OWNER } from "./identity.mjs";
import {
  ahead,
  at,
  credits,
  insert,
  NOW,
  period,
  seedId,
  SEED_MODEL,
  shift,
  sqlValue,
} from "./sql.mjs";
import { buildThread, toolCall } from "./thread.mjs";
import {
  INITIATIVES,
  PROJECTS,
  taskId,
  WORK_TEAMMATES,
  WORKSPACE_ID,
  workContextId,
} from "./work-ids.mjs";

export const MISSION =
  "Northstar Studio builds calm, reliable software for small teams. Ship a dependable release every month, grow sign-ups through the website, and answer every customer within a day.";

const WORKSPACE_CAP = credits(150);

function memoryDocument(statements, { id, content, createdAt }) {
  statements.push(
    insert("resource", {
      resource_type: "memory",
      id,
      scope_type: "personal",
      scope_id: String(OWNER.id),
      kind: "teammate_context",
      title: id,
      content,
      revision: 1,
      created_by_user_id: OWNER.id,
      created_at: createdAt,
      updated_at: at({ hours: 2 }),
    }),
    insert("resource_revision", {
      resource_type: "memory",
      id: `${id}-r1`,
      document_id: id,
      revision: 1,
      text_content: content,
      change_note: "Seeded",
      operation_id: `seed:${id}`,
      created_by: OWNER.id,
      created_at: createdAt,
    }),
  );
}

function teammateRow({ id, name, description, prompt, createdAt }) {
  return insert("teammates", {
    id,
    user_id: OWNER.id,
    owner_scope_type: "workspace",
    owner_scope_id: WORKSPACE_ID,
    name,
    description,
    servers: [],
    model: SEED_MODEL,
    temperature: "0.3",
    max_steps: 20,
    system_prompt: prompt,
    enabled_tools: [],
    mode: "agent",
    kind: "colleague",
    created_at: createdAt,
    updated_at: at({ days: 1 }),
  });
}

const HIRES = [
  {
    key: "atlas",
    id: WORK_TEAMMATES.atlas,
    name: "Atlas",
    title: "Studio lead",
    description: "Runs Northstar Studio: plans the work, staffs it and keeps it moving.",
    prompt:
      "You lead Northstar Studio. Turn the mission into initiatives and projects, hire and brief the team, route work, unblock your reports before asking a person, and report plainly.",
    reportsTo: null,
    heartbeatMinutes: 240,
    cap: null,
    projects: [PROJECTS.launch, PROJECTS.website, PROJECTS.support, PROJECTS.company],
    context:
      "# Working context\n\n- Mission first: one dependable release a month.\n- Answer reports' questions before escalating.\n- Nicholas approves hires, budgets and anything sent to customers.",
  },
  {
    key: "release-bot",
    id: seedId("teammate", "release-bot"),
    name: "Release bot",
    title: "Release engineer",
    reportsTo: WORK_TEAMMATES.atlas,
    heartbeatMinutes: null,
    cap: credits(40),
    projects: [PROJECTS.launch],
    context:
      "# Working context\n\n- Small pull requests with tests.\n- Never merge to main; open a review branch.\n- Release notes in the changelog voice.",
  },
  {
    key: "mara",
    id: WORK_TEAMMATES.mara,
    name: "Mara",
    title: "Copywriter",
    description: "Writes the website, newsletters and release notes.",
    prompt:
      "You write for Northstar Studio: short, plain British English, one idea per sentence, no marketing fluff. Save finished copy as documents.",
    reportsTo: WORK_TEAMMATES.atlas,
    heartbeatMinutes: null,
    cap: credits(20),
    budgetWarned: true,
    projects: [PROJECTS.website, PROJECTS.launch],
    context:
      "# Working context\n\n- Voice: calm, specific, no exclamation marks.\n- Quote customers only with written permission.",
  },
  {
    key: "juno",
    id: WORK_TEAMMATES.juno,
    name: "Juno",
    title: "Support agent",
    description: "Answers customers, files cases and writes help articles.",
    prompt:
      "You answer Northstar customers within a day. Draft replies for approval, file a case for anything you cannot fix, and turn repeated questions into help articles.",
    reportsTo: WORK_TEAMMATES.atlas,
    heartbeatMinutes: 60,
    cap: credits(30),
    projects: [PROJECTS.support],
    context:
      "# Working context\n\n- Reply within a day, even if only to say what happens next.\n- Never send to a customer without approval.",
  },
];

const PROPOSED = {
  key: "quinn",
  id: WORK_TEAMMATES.quinn,
  name: "Quinn",
  title: "Product analyst",
  description: "Reads usage and support data and says what to build next.",
  prompt:
    "You analyse Northstar's usage and support cases and recommend the next most valuable piece of work, with the evidence.",
};

function setupPlan() {
  return setupPlanSchema.parse({
    mission: MISSION,
    monthlyCreditCapMicros: WORKSPACE_CAP,
    initiatives: [
      {
        key: "i1",
        name: "Ship the autumn release",
        description:
          "Scheduled runs, quoted selections and machine handoffs, released by mid-November.",
      },
      {
        key: "i2",
        name: "Grow sign-ups by a fifth",
        description: "A clearer pricing page and a monthly newsletter that people read.",
      },
      {
        key: "i3",
        name: "Answer every customer within a day",
        description: "One support inbox, drafted replies and help articles for repeated questions.",
      },
    ],
    projects: [
      {
        key: "p1",
        name: "Autumn launch",
        description:
          "Ship the September release: scheduled runs, quoted selections and machine handoffs.",
        taskPrefix: "LNCH",
        initiative: "i1",
        standup: {
          enabled: true,
          time: "09:15",
          days: [1, 2, 3, 4, 5],
          timeZone: "Europe/London",
          questions: ["What did you finish?", "What's next?", "Anything in your way?"],
          participants: "everyone",
          windowMinutes: 180,
        },
      },
      {
        key: "p2",
        name: "Website refresh",
        description: "Marketing site copy and design refresh.",
        taskPrefix: "WEB",
        initiative: "i2",
      },
      {
        key: "p3",
        name: "Support desk",
        description: "Customer questions from email, with drafted replies and help articles.",
        taskPrefix: "SUP",
        initiative: "i3",
      },
    ],
    teammates: [
      {
        key: "t1",
        name: "Release bot",
        title: "Release engineer",
        jobDescription: "Builds and ships the release in small reviewed pull requests.",
        monthlyCreditCapMicros: credits(40),
        projects: ["p1"],
      },
      {
        key: "t2",
        name: "Mara",
        title: "Copywriter",
        jobDescription: "Writes the website, newsletters and release notes.",
        monthlyCreditCapMicros: credits(20),
        projects: ["p2", "p1"],
      },
      {
        key: "t3",
        name: "Juno",
        title: "Support agent",
        jobDescription: "Answers customers within a day and writes help articles.",
        heartbeatMinutes: 60,
        monthlyCreditCapMicros: credits(30),
        projects: ["p3"],
      },
    ],
    tasks: [
      {
        project: "p1",
        objective: "Show unread counts in the sidebar",
        owner: "t1",
        priority: "high",
      },
      { project: "p2", objective: "Rewrite the pricing page copy", owner: "t2", priority: "high" },
    ],
    connectors: [
      {
        provider: "github",
        access: "write",
        projects: ["p1"],
        reason: "Open review branches and pull requests for the release.",
      },
    ],
    suggestions: [
      {
        provider: "zendesk",
        reason: "Pull support tickets in directly instead of forwarding email.",
      },
    ],
  });
}

function homeConversation(statements, hire, createdAt) {
  const thread = buildThread(
    {
      id: seedId("work", "home", hire.key),
      userId: OWNER.id,
      title: hire.name,
      type: "chat",
      createdAt,
    },
    [
      { role: "user", content: `You joined Northstar Studio as ${hire.title}.` },
      {
        role: "assistant",
        content: `Thanks. I've read the mission and my projects. I'll post progress on each task's thread.`,
      },
    ],
  );

  statements.push(...thread.statements);

  return thread.conversationId;
}

function wakeId(hireKey, projectId) {
  return `${seedId("work", "home", hireKey)}_${projectId}`;
}

const JUNO_WAKE_ID = wakeId("juno", PROJECTS.support);

function wakeConversation(statements, hire, projectId, projectName) {
  const id = wakeId(hire.key, projectId);

  statements.push(
    insert("conversation", {
      id,
      user_id: OWNER.id,
      type: "chat",
      title: `Wakes in ${projectName}`,
      project_id: projectId,
      message_count: 0,
      created_at: at({ days: 20 }),
      updated_at: at({ hours: 1 }),
      model_id: SEED_MODEL,
      permission_mode: "auto_accept_edits",
    }),
  );

  return id;
}

const PROJECT_NAMES = {
  [PROJECTS.launch]: "Autumn launch",
  [PROJECTS.website]: "Website refresh",
  [PROJECTS.support]: "Support desk",
  [PROJECTS.company]: "Company",
};

function railRun(
  statements,
  { key, hire, projectId, task, status, trigger, hoursAgo, creditAmount },
) {
  const id = seedId("run", "rail", key);
  const createdAt = at({ hours: hoursAgo });
  const settled = shift(createdAt, { minutes: 4 });
  const terminal = status === "succeeded" || status === "failed";

  statements.push(
    insert("conversation_run", {
      id,
      conversation_id: wakeId(hire, projectId),
      project_id: projectId,
      project_task_id: task ?? null,
      initiator_user_id: OWNER.id,
      teammate_context_id: workContextId(hire),
      trigger,
      status,
      attempt: 1,
      event_sequence: 0,
      terminal_reason: status === "failed" ? "The provider returned an empty response" : null,
      created_at: createdAt,
      updated_at: settled,
      started_at: shift(createdAt, { seconds: 2 }),
      completed_at: terminal ? settled : null,
      provenance_json: { site: "hosted", vendor: "workers-ai", model: SEED_MODEL },
    }),
    insert("usage_event", {
      id: seedId("usage", "rail", key),
      idempotency_key: seedId("usage-key", "rail", key),
      user_id: OWNER.id,
      workspace_id: WORKSPACE_ID,
      project_id: projectId,
      run_id: id,
      occurred_at: settled,
      period: period(),
      source: "model",
      vendor: "workers-ai",
      resource: SEED_MODEL,
      unit: "tokens",
      quantity: Math.round(creditAmount * 9_000),
      cost_micros: Math.round(creditAmount * 100_000),
      credit_micros: credits(creditAmount),
      billable: true,
      byok: false,
      estimated: false,
      site: "hosted",
    }),
  );
}

export function workTeamStatements() {
  const statements = [];
  const setupAt = at({ days: 21 });
  const appliedAt = at({ days: 20 });
  const plan = setupPlan();

  for (const hire of [...HIRES, PROPOSED]) {
    if (hire.key !== "release-bot") {
      statements.push(
        teammateRow({
          id: hire.id,
          name: hire.name,
          description: hire.description,
          prompt: hire.prompt,
          createdAt: hire.key === "atlas" ? setupAt : appliedAt,
        }),
      );
    }
  }

  for (const hire of HIRES) {
    const contextId = workContextId(hire.key);
    const memoryId = seedId("teammate-memory", hire.key, "northstar");
    const home = homeConversation(statements, hire, hire.key === "atlas" ? setupAt : appliedAt);

    for (const projectId of hire.projects) {
      if (wakeId(hire.key, projectId) !== JUNO_WAKE_ID) {
        wakeConversation(statements, hire, projectId, PROJECT_NAMES[projectId]);
      }
    }

    memoryDocument(statements, { id: memoryId, content: hire.context, createdAt: appliedAt });
    statements.push(
      insert("teammate_context", {
        id: contextId,
        teammate_id: hire.id,
        actor_user_id: OWNER.id,
        scope_type: "workspace",
        scope_id: WORKSPACE_ID,
        home_conversation_id: home,
        memory_document_id: memoryId,
        status: "active",
        autonomy_level: "partner",
        created_at: appliedAt,
        updated_at: at({ hours: 1 }),
      }),
      insert("workspace_teammate", {
        workspace_id: WORKSPACE_ID,
        teammate_id: hire.id,
        title: hire.title,
        reports_to_teammate_id: hire.reportsTo,
        status: "active",
        responsible_user_id: OWNER.id,
        heartbeat_minutes: hire.heartbeatMinutes,
        last_heartbeat_at: hire.heartbeatMinutes ? at({ minutes: 35 }) : null,
        last_wake: workWakeRecordSchema.parse({
          at: at({ hours: 1 }),
          projectId: hire.projects[0],
          reason: hire.heartbeatMinutes ? "heartbeat" : "assigned",
          taskId: null,
          settled: true,
        }),
        monthly_credit_cap_micros: hire.cap,
        budget_warned_period: hire.budgetWarned ? period() : null,
        project_ids: hire.projects,
        created_at: hire.key === "atlas" ? setupAt : appliedAt,
        updated_at: at({ days: 1 }),
      }),
    );
  }

  statements.push(
    insert("workspace_teammate", {
      workspace_id: WORKSPACE_ID,
      teammate_id: PROPOSED.id,
      title: PROPOSED.title,
      reports_to_teammate_id: WORK_TEAMMATES.atlas,
      status: "proposed",
      responsible_user_id: OWNER.id,
      heartbeat_minutes: 1440,
      monthly_credit_cap_micros: credits(15),
      project_ids: [PROJECTS.launch, PROJECTS.website],
      proposal: hireProposalSchema.parse({
        reason:
          "Juno has filed three cases about exports this month and the release has no usage data behind it. Quinn would read usage and support together and tell us what to build next.",
        proposedByTeammateId: WORK_TEAMMATES.atlas,
        proposedByUserId: null,
        roleSlug: null,
        jobDescription: PROPOSED.prompt,
        projectIds: [PROJECTS.launch, PROJECTS.website],
        proposedAt: at({ hours: 6 }),
      }),
      created_at: at({ hours: 6 }),
      updated_at: at({ hours: 6 }),
    }),
  );

  const initiatives = [
    {
      id: INITIATIVES.release,
      name: "Ship the autumn release",
      description: plan.initiatives[0].description,
      targetDate: ahead({ days: 21 }).slice(0, 10),
      owner: WORK_TEAMMATES.atlas,
    },
    {
      id: INITIATIVES.growth,
      name: "Grow sign-ups by a fifth",
      description: plan.initiatives[1].description,
      targetDate: ahead({ days: 60 }).slice(0, 10),
      owner: WORK_TEAMMATES.mara,
    },
    {
      id: INITIATIVES.support,
      name: "Answer every customer within a day",
      description: plan.initiatives[2].description,
      targetDate: null,
      owner: WORK_TEAMMATES.juno,
    },
  ];

  initiatives.forEach((initiative, index) => {
    statements.push(
      insert("initiative", {
        id: initiative.id,
        workspace_id: WORKSPACE_ID,
        name: initiative.name,
        description: initiative.description,
        status: "active",
        target_date: initiative.targetDate,
        owner_teammate_id: initiative.owner,
        position: index,
        created_at: appliedAt,
        updated_at: at({ days: 2 }),
      }),
    );
  });

  const setupState = setupPlanStateSchema.parse({
    revision: 2,
    plan,
    appliedAt,
    created: {
      projectIds: [PROJECTS.launch, PROJECTS.website, PROJECTS.support],
      teammateIds: [seedId("teammate", "release-bot"), WORK_TEAMMATES.mara, WORK_TEAMMATES.juno],
      initiativeIds: initiatives.map((initiative) => initiative.id),
      taskIds: [taskId("launch", 2), taskId("website", 1)],
    },
  });
  const routines = leadRoutinesSchema.parse({
    dailyBrief: {
      enabled: true,
      time: "08:30",
      days: [1, 2, 3, 4, 5],
      timeZone: "Europe/London",
      lastRunAt: NOW.toISOString(),
    },
    initiativeReview: {
      enabled: true,
      time: "09:00",
      days: [1],
      timeZone: "Europe/London",
      lastRunAt: NOW.toISOString(),
    },
  });

  statements.push(
    `UPDATE "workspace" SET "mission" = ${sqlValue(MISSION)}, "monthly_credit_cap_micros" = ${WORKSPACE_CAP}, "lead_teammate_id" = ${sqlValue(WORK_TEAMMATES.atlas)}, "setup_project_id" = ${sqlValue(PROJECTS.company)}, "setup_task_id" = ${sqlValue(taskId("company", 1))}, "setup_plan" = ${sqlValue(setupState)}, "lead_routines" = ${sqlValue(routines)} WHERE "id" = ${sqlValue(WORKSPACE_ID)};`,
    insert("template", {
      id: seedId("template", "northstar-team"),
      created_by_user_id: OWNER.id,
      workspace_id: null,
      kind: "team",
      name: "Small software studio",
      description:
        "A lead, a release engineer, a copywriter and a support agent across release, website and support.",
      configuration: plan,
      status: "active",
      created_at: at({ days: 5 }),
      updated_at: at({ days: 5 }),
    }),
  );

  const rails = [
    ...[22, 18, 14, 10, 6, 2].map((hoursAgo, index) => ({
      key: `atlas-heartbeat-${index}`,
      hire: "atlas",
      projectId: PROJECTS.company,
      status: "succeeded",
      trigger: "schedule",
      hoursAgo,
      creditAmount: 1.6,
    })),
    {
      key: "atlas-brief",
      hire: "atlas",
      projectId: PROJECTS.company,
      task: taskId("company", 2),
      status: "succeeded",
      trigger: "handle",
      hoursAgo: 10,
      creditAmount: 3.4,
    },
    {
      key: "atlas-unblock",
      hire: "atlas",
      projectId: PROJECTS.launch,
      task: taskId("launch", 5),
      status: "succeeded",
      trigger: "handle",
      hoursAgo: 19,
      creditAmount: 1.2,
    },
    {
      key: "release-flaky",
      hire: "release-bot",
      projectId: PROJECTS.launch,
      task: taskId("launch", 5),
      status: "failed",
      trigger: "handle",
      hoursAgo: 20,
      creditAmount: 6.5,
    },
    {
      key: "release-audit",
      hire: "release-bot",
      projectId: PROJECTS.launch,
      task: taskId("launch", 3),
      status: "succeeded",
      trigger: "handle",
      hoursAgo: 8,
      creditAmount: 4.2,
    },
    {
      key: "mara-pricing",
      hire: "mara",
      projectId: PROJECTS.website,
      task: taskId("website", 1),
      status: "succeeded",
      trigger: "handle",
      hoursAgo: 16,
      creditAmount: 9.5,
    },
    {
      key: "mara-quotes",
      hire: "mara",
      projectId: PROJECTS.website,
      task: taskId("website", 4),
      status: "succeeded",
      trigger: "handle",
      hoursAgo: 5,
      creditAmount: 7.1,
    },
    ...[23, 21, 17, 13, 9, 4, 1].map((hoursAgo, index) => ({
      key: `juno-heartbeat-${index}`,
      hire: "juno",
      projectId: PROJECTS.support,
      status: "succeeded",
      trigger: "schedule",
      hoursAgo,
      creditAmount: 0.8,
    })),
  ];

  for (const rail of rails) {
    railRun(statements, rail);
  }

  const waiting = buildThread(
    {
      id: JUNO_WAKE_ID,
      userId: OWNER.id,
      title: "Wakes in Support desk",
      type: "chat",
      projectId: PROJECTS.support,
      createdAt: at({ minutes: 50 }),
      run: {
        status: "awaiting_approval",
        trigger: "schedule",
        teammateContextId: workContextId("juno"),
        projectId: PROJECTS.support,
      },
    },
    [
      {
        role: "user",
        content:
          "You are Juno, Support agent. Your scheduled heartbeat came round. Check the Support desk for anything waiting on you.",
      },
      ...toolCall({
        name: "send_email",
        callId: "call_juno_reply",
        input: {
          to: "ellie@brightdesk.example",
          subject: "Re: Exporting invoices",
          body: "Hi Ellie, you can export invoices from Billing → History → Export while we fix the CSV button. I'll write again when it's live. Juno",
        },
        result:
          "Reply to Ellie Hart with the CSV workaround and a promise to follow up when the fix ships.",
        status: "pending",
      }),
    ],
  );

  statements.push(...waiting.statements);

  return { statements, setupState };
}

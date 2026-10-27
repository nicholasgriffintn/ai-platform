import {
  projectTaskCompletionSchema,
  projectTaskDetailsSchema,
  projectTaskRunnerSchema,
  workActorSchema,
  workPostAuthorSchema,
} from "@ngriffin_uk/polychat-schemas";
import { formatZonedDayLabel } from "@ngriffin_uk/polychat-utility-core";

import { COLLEAGUES, OWNER } from "./identity.mjs";
import { ahead, at, insert, NOW, seedId, SEED_MODEL, sha256Hex, shift, sqlValue } from "./sql.mjs";
import { buildThread } from "./thread.mjs";
import { PROJECTS, taskId, WORK_TEAMMATES, WORKSPACE_ID, workContextId } from "./work-ids.mjs";

const TIME_ZONE = "Europe/London";
const PREFIXES = { launch: "LNCH", website: "WEB", support: "SUP", company: "CO" };
const NAMES = {
  atlas: "Atlas",
  "release-bot": "Release bot",
  mara: "Mara",
  juno: "Juno",
};

function teammateIds(releaseBot) {
  return { ...WORK_TEAMMATES, "release-bot": releaseBot };
}

function dayLabel(iso) {
  return formatZonedDayLabel(new Date(iso), TIME_ZONE);
}

function author(kind, key) {
  if (kind === "person") {
    return workPostAuthorSchema.parse({ kind, name: OWNER.name, userId: OWNER.id });
  }

  if (kind === "system") {
    return workPostAuthorSchema.parse({ kind, name: "Work" });
  }

  return workPostAuthorSchema.parse({
    kind: "teammate",
    name: NAMES[key],
    teammateId: key === "release-bot" ? seedId("teammate", "release-bot") : WORK_TEAMMATES[key],
  });
}

function post(kind, by, body, occurredAt) {
  const [authorKind, key] = by.split(":");

  return {
    role: kind === "comment" ? "user" : "assistant",
    content: body,
    model: null,
    provenance: null,
    run: false,
    at: occurredAt,
    data: { workPost: { kind, author: author(authorKind, key) } },
  };
}

function postStatements(conversationId, posts) {
  return posts.map((message, index) =>
    insert("message", {
      id: `${conversationId}-p${index + 1}`,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      status: "complete",
      timestamp: Date.parse(message.at),
      platform: "web",
      data: message.data,
      created_at: message.at,
      updated_at: message.at,
    }),
  );
}

function document(title, body, conversationId, projectId, createdAt) {
  const id = seedId("output", "work", title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"));
  const content = { format: "markdown", body };

  return [
    insert("resource", {
      resource_type: "output",
      id,
      created_by_user_id: OWNER.id,
      scope_type: "project",
      scope_id: projectId,
      conversation_id: conversationId,
      capability_id: "documents",
      kind: "document",
      title,
      status: "ready",
      sensitivity: "internal",
      content,
      revision: 1,
      created_at: createdAt,
      updated_at: createdAt,
      revision_created_by_user_id: OWNER.id,
      revision_created_at: createdAt,
      revision_operation: "created",
    }),
    insert("resource_revision", {
      resource_type: "output",
      output_id: id,
      revision: 1,
      title,
      status: "ready",
      sensitivity: "internal",
      content,
      created_by_user_id: OWNER.id,
      created_at: createdAt,
      operation: "created",
    }),
  ];
}

const DAILY_BRIEF = `# Daily brief

**Decisions for you**
- Approve Release bot's migration on LNCH-6 before it can finish quoted selections.
- Juno replied to Ellie Hart on SUP-1 and asks whether to offer Brightdesk a month's credit.
- Quinn is proposed as Product analyst: £15 a month, reads usage and support together.

**Moved since yesterday**
- WEB-4 done: Mara collected three customer quotes with written permission.
- WEB-1 pricing copy is ready for your review.
- LNCH-5 failed on an empty provider response. I retried it on a fresh sandbox, nothing needed from you.

**Spend**
- £61 of £150 this month. Mara has used 80% of her £20 cap.`;

const INITIATIVE_REVIEW = `# Initiative review

**Ship the autumn release** — on track. Quoted selections is three sub-tasks in; the migration on LNCH-6 is the only thing between us and the release branch.

**Grow sign-ups by a fifth** — at risk. Pricing copy is waiting on review and the newsletter plan (WEB-3) needs its breakdown accepted.

**Answer every customer within a day** — on track. Median first reply is 3 hours. Exports are the top question three weeks running, so I raised SUP-3 for a help article.`;

const PRICING_COPY = `# Pricing

**Free** — try Polychat with hosted models and a monthly allowance.

**Pro** — £8 a month. Frontier models, generation, live voice, sandboxed runs and Work.

**Enterprise** — talk to us about seats, audit and data residency.

Start with Free. Upgrade when you hit the allowance.`;

const CUSTOMER_QUOTES = `# Customer quotes

> "We stopped copying tasks between three tools." — Ellie Hart, Brightdesk

> "The release bot writes better notes than we did." — Sam Okafor, Lantern

> "Support replies the same morning now." — Priya Shah, Fieldwork

All three gave written permission on 21 October.`;

function completion(task, conversationId, runId, { status, mode = "human", output, outputIds }) {
  return projectTaskCompletionSchema.parse({
    id: seedId("completion", task.id),
    stageId: task.stage ?? null,
    conversationId,
    goalId: seedId("goal", task.id),
    runId,
    outputIds,
    output,
    evidence: [
      {
        claim: "Acceptance criteria met",
        route: "task",
        evidence_surface: "conversation",
        status: "confirmed",
      },
    ],
    approval: {
      mode,
      status,
      reviewedByUserId: status === "approved" && mode === "human" ? OWNER.id : null,
      reviewedAt: status === "approved" ? (task.completed ?? null) : null,
    },
    createdAt: task.completed ?? task.updated ?? at({ hours: 2 }),
  });
}

function goalRow(task, conversationId, userId) {
  const finishedAt = task.completed ?? task.updated ?? at({ hours: 2 });

  return insert("goal", {
    id: seedId("goal", task.id),
    conversation_id: conversationId,
    user_id: userId,
    objective: task.objective,
    status: "completed",
    source: "user",
    iteration_count: 2,
    tokens_spent: 8_200,
    progress: [
      {
        iteration: 2,
        surface: "conversation",
        summary: "Objective met.",
        evidence: ["Acceptance criteria met"],
        at: finishedAt,
      },
    ],
    evidence: [
      {
        claim: "Acceptance criteria met",
        route: "task",
        evidence_surface: "conversation",
        status: "confirmed",
      },
    ],
    created_at: task.created,
    updated_at: finishedAt,
    completed_at: finishedAt,
  });
}

function taskDefinitions({ threads }) {
  const standupAt = at({ minutes: 50 });
  const briefAt = at({ hours: 6 });
  const reviewAt = at({ days: 1, hours: 2 });
  const breakdownAt = at({ days: 2 });

  return [
    {
      project: "company",
      number: 1,
      objective: "Set up Northstar Studio",
      description:
        "Read the mission, propose initiatives, projects and a team, and apply the plan once it is approved.",
      status: "done",
      priority: "high",
      owner: "atlas",
      created: at({ days: 21 }),
      started: at({ days: 21 }),
      completed: at({ days: 20 }),
      run: { status: "succeeded", trigger: "handle" },
      brief: "Set up Northstar Studio from its mission.",
      reply:
        "I proposed three initiatives, three projects and three hires. Revision 2 is applied: Support desk is its own project and Mara is capped at £20.",
      completion: { status: "approved", output: "Workspace set up from revision 2 of the plan." },
      posts: [
        ["event", "system", "Atlas started setting up the workspace.", { days: 21 }],
        [
          "update",
          "teammate:atlas",
          "Proposed plan: 3 initiatives, 3 projects (Autumn launch, Website refresh, Support), 3 hires and 2 first tasks. GitHub is the only connector I need.",
          { days: 21, hours: -1 },
        ],
        [
          "comment",
          "person",
          "Make support its own project and keep Mara under £20 a month.",
          { days: 20, hours: 3 },
        ],
        [
          "update",
          "teammate:atlas",
          "Revision 2: Support desk is a project with Juno on an hourly heartbeat, and Mara's cap is £20.",
          { days: 20, hours: 2 },
        ],
        [
          "event",
          "system",
          "Plan applied: created Autumn launch, Website refresh and Support desk, hired Release bot, Mara and Juno, and opened LNCH-2 and WEB-1.",
          { days: 20 },
        ],
      ],
    },
    {
      project: "company",
      number: 2,
      objective: `Daily brief · ${dayLabel(briefAt)}`,
      description:
        "Write today's brief: what moved, what is blocked and on whom, what is waiting on you, and spend against budget.",
      status: "done",
      priority: "medium",
      owner: "atlas",
      created: briefAt,
      started: briefAt,
      completed: shift(briefAt, { minutes: 6 }),
      run: { status: "succeeded", trigger: "handle" },
      brief: "Write today's brief.",
      reply: "Today's brief is ready. Three decisions are waiting on you.",
      output: ["Daily brief", DAILY_BRIEF],
      completion: { status: "approved", mode: "automated", output: "Daily brief written." },
      posts: [["event", "system", "Daily brief routine opened this task.", { hours: 6 }]],
    },
    {
      project: "company",
      number: 3,
      objective: `Initiative review · ${dayLabel(reviewAt)}`,
      description: "Review each initiative against the mission and fix what is stalled.",
      status: "review",
      priority: "medium",
      owner: "atlas",
      reviewer: { type: "person", userId: OWNER.id },
      created: reviewAt,
      started: reviewAt,
      updated: shift(reviewAt, { minutes: 9 }),
      run: { status: "succeeded", trigger: "handle" },
      brief: "Review each initiative.",
      reply: "Two initiatives are on track and one is at risk. Details are in the review.",
      output: ["Initiative review", INITIATIVE_REVIEW],
      completion: { status: "pending", output: "Initiative review written." },
      posts: [
        ["event", "system", "Initiative review routine opened this task.", { days: 1, hours: 2 }],
        [
          "update",
          "teammate:atlas",
          "Sign-ups is at risk: two tasks are waiting on you. I raised SUP-3 for the export questions.",
          { days: 1, hours: 1 },
        ],
      ],
    },
    {
      project: "launch",
      number: 1,
      objective: "Ship quoted selections",
      description:
        "Let people quote a selection of a reply into the composer. Split it into reviewable pieces and land it before the release branch is cut.",
      status: "running",
      priority: "high",
      owner: "atlas",
      stage: "build",
      due: ahead({ days: 14 }),
      created: at({ days: 6 }),
      started: at({ days: 5 }),
      details: {
        breakdown: {
          revision: 1,
          items: [
            {
              key: "k1",
              objective: "Add retries to the fetch helper",
              owner: { type: "teammate", id: "release-bot" },
            },
            {
              key: "k2",
              objective: "Approve the user_resource_state migration",
              owner: { type: "teammate", id: "release-bot" },
            },
            {
              key: "k3",
              objective: "Write the September release notes",
              owner: { type: "teammate", id: "mara" },
              dependsOn: ["k1"],
            },
          ],
          proposedBy: { type: "teammate", id: "atlas" },
          proposedAt: at({ days: 6 }),
          acceptedBy: { type: "person", userId: OWNER.id },
          acceptedAt: at({ days: 5 }),
          taskIds: { k1: taskId("launch", 3), k2: taskId("launch", 6), k3: taskId("launch", 4) },
        },
      },
      posts: [
        ["update", "teammate:atlas", "Proposed a three-part breakdown.", { days: 6 }],
        [
          "event",
          "system",
          `${OWNER.name} accepted the breakdown. Created LNCH-3, LNCH-6 and LNCH-4.`,
          { days: 5 },
        ],
      ],
    },
    {
      project: "launch",
      number: 2,
      objective: "Show unread counts in the sidebar",
      status: "done",
      priority: "high",
      owner: "release-bot",
      stage: "review",
      created: at({ days: 20 }),
      started: at({ days: 2, hours: 6 }),
      completed: at({ days: 2, hours: 5 }),
      thread: threads.done,
      completion: {
        status: "approved",
        output: "Unread counts render next to each group. Pull request 41 is merged.",
      },
    },
    {
      project: "launch",
      number: 3,
      objective: "Add retries to the fetch helper",
      status: "running",
      priority: "medium",
      owner: "release-bot",
      stage: "build",
      parent: 1,
      created: at({ days: 5 }),
      started: at({ hours: 4 }),
      thread: threads.running,
    },
    {
      project: "launch",
      number: 4,
      objective: "Write the September release notes",
      status: "backlog",
      priority: "medium",
      owner: "mara",
      stage: "plan",
      parent: 1,
      dependsOn: [3],
      due: ahead({ days: 10 }),
      created: at({ days: 5 }),
    },
    {
      project: "launch",
      number: 5,
      objective: "Fix the flaky onboarding e2e test",
      status: "blocked",
      priority: "medium",
      owner: "release-bot",
      stage: "build",
      blocked: ["run_failed", "Polychat API returned an empty completion response"],
      created: at({ days: 2 }),
      started: at({ days: 1, hours: 3 }),
      thread: threads.failed,
      attention: 2,
      handoff: "atlas",
      details: { unblocker: { type: "teammate", id: "atlas" } },
      posts: [
        [
          "update",
          "teammate:atlas",
          "The provider returned an empty response, not a test failure. I'm retrying on a fresh sandbox tonight. Nothing needed from you.",
          { hours: 19 },
        ],
      ],
    },
    {
      project: "launch",
      number: 6,
      objective: "Approve the user_resource_state migration",
      description: "Apply the migration that stores quoted selections per reader.",
      status: "blocked",
      priority: "high",
      owner: "release-bot",
      stage: "build",
      parent: 1,
      blocked: [
        "awaiting_approval",
        "The run wants to apply a migration and this stage asks before writes.",
      ],
      approvals: ["write", "sandbox"],
      created: at({ days: 5 }),
      started: at({ hours: 3 }),
      attention: 3,
    },
    {
      project: "launch",
      number: 7,
      kind: "standup",
      objective: `Standup · ${dayLabel(standupAt)}`,
      status: "backlog",
      priority: "none",
      owner: "atlas",
      created: standupAt,
      details: {
        standup: {
          date: standupAt.slice(0, 10),
          questions: ["What did you finish?", "What's next?", "Anything in your way?"],
          participants: [
            { actor: { type: "person", userId: OWNER.id }, name: OWNER.name },
            { actor: { type: "teammate", id: "release-bot" }, name: "Release bot" },
            { actor: { type: "teammate", id: "mara" }, name: "Mara" },
          ],
          answers: [
            {
              actor: { type: "teammate", id: "release-bot" },
              name: "Release bot",
              answers: [
                { question: "What did you finish?", answer: "Unread counts are merged." },
                {
                  question: "What's next?",
                  answer: "Retries in the fetch helper, tests running now.",
                },
                {
                  question: "Anything in your way?",
                  answer: "LNCH-6 needs approval to apply the migration.",
                },
              ],
              answeredAt: shift(standupAt, { minutes: 4 }),
            },
            {
              actor: { type: "teammate", id: "mara" },
              name: "Mara",
              answers: [
                {
                  question: "What did you finish?",
                  answer: "Three customer quotes, with permission.",
                },
                { question: "What's next?", answer: "Release notes once the retries land." },
                {
                  question: "Anything in your way?",
                  answer: "I'm at 80% of my budget for the month.",
                },
              ],
              answeredAt: shift(standupAt, { minutes: 7 }),
            },
          ],
          closesAt: ahead({ hours: 2 }),
        },
      },
    },
    {
      project: "launch",
      number: 8,
      objective: "Export the workspace audit log as CSV",
      status: "queued",
      priority: "low",
      owner: "release-bot",
      stage: "build",
      created: at({ hours: 5 }),
      dispatch: true,
    },
    {
      project: "launch",
      number: 9,
      objective: "Document machine handoffs for the desktop app",
      status: "backlog",
      priority: "low",
      person: COLLEAGUES[1].id,
      stage: "plan",
      dependsOn: [2],
      created: at({ days: 3 }),
    },
    {
      project: "launch",
      number: 10,
      objective: "Decide whether quoted selections ship behind a flag",
      description:
        "Release bot wants a flag so we can roll back; Mara wants it on for everyone so the release notes can lead with it.",
      status: "backlog",
      priority: "high",
      owner: "atlas",
      created: at({ hours: 9 }),
      details: {
        escalation: {
          to: { type: "person", userId: OWNER.id },
          reason:
            "Release bot and Mara disagree and both have a point. This changes what we promise customers, so it is your call.",
          by: { type: "teammate", id: "atlas" },
          at: at({ hours: 8 }),
        },
      },
    },
    {
      project: "website",
      number: 1,
      objective: "Rewrite the pricing page copy",
      description: "Three plans, one call to action, no marketing fluff.",
      status: "review",
      priority: "high",
      owner: "mara",
      reviewer: { type: "person", userId: OWNER.id },
      created: at({ days: 20 }),
      started: at({ hours: 16 }),
      updated: at({ hours: 15 }),
      run: { status: "succeeded", trigger: "handle" },
      brief: "Rewrite the pricing page: three plans, one call to action, no marketing fluff.",
      reply: "Pricing copy is ready for review. I kept it to one call to action.",
      output: ["Pricing page copy", PRICING_COPY],
      completion: { status: "pending", output: "Pricing copy rewritten with three plans." },
      posts: [
        [
          "update",
          "teammate:mara",
          "Draft saved as a document. Ready for your review.",
          { hours: 15 },
        ],
      ],
    },
    {
      project: "website",
      number: 2,
      objective: "Audit dark mode contrast",
      status: "cancelled",
      priority: "low",
      person: COLLEAGUES[2].id,
      created: at({ days: 12 }),
      posts: [
        ["comment", "person", "Cancelling: the design system refresh covers this.", { days: 9 }],
      ],
    },
    {
      project: "website",
      number: 3,
      objective: "Plan the November newsletter",
      status: "backlog",
      priority: "medium",
      owner: "atlas",
      due: ahead({ days: 12 }),
      created: breakdownAt,
      details: {
        breakdown: {
          revision: 1,
          items: [
            {
              key: "draft",
              objective: "Draft the newsletter around the autumn release",
              owner: { type: "teammate", id: "mara" },
            },
            {
              key: "quotes",
              objective: "Pick one customer quote to feature",
              owner: { type: "teammate", id: "mara" },
            },
            {
              key: "send",
              objective: "Schedule the send for the first Tuesday",
              owner: { type: "person", userId: OWNER.id },
              dependsOn: ["draft", "quotes"],
            },
          ],
          proposedBy: { type: "teammate", id: "atlas" },
          proposedAt: breakdownAt,
        },
      },
    },
    {
      project: "website",
      number: 4,
      objective: "Collect three customer quotes",
      status: "done",
      priority: "medium",
      owner: "mara",
      created: at({ days: 4 }),
      started: at({ hours: 5 }),
      completed: at({ hours: 4 }),
      run: { status: "succeeded", trigger: "handle" },
      brief: "Collect three customer quotes we have permission to use.",
      reply: "Three quotes collected, each with written permission.",
      output: ["Customer quotes", CUSTOMER_QUOTES],
      completion: {
        status: "approved",
        mode: "automated",
        output: "Three quotes with permission.",
      },
    },
    {
      project: "support",
      number: 1,
      kind: "case",
      objective: "Exporting invoices gives a blank CSV",
      description: "Ellie at Brightdesk gets an empty file from Billing → Export.",
      status: "backlog",
      priority: "high",
      owner: "juno",
      created: at({ hours: 3 }),
      details: {
        case: {
          source: "email",
          requester: { name: "Ellie Hart", address: "ellie@brightdesk.example" },
        },
      },
    },
    {
      project: "support",
      number: 2,
      kind: "case",
      objective: "Can't sign in with Google",
      status: "done",
      priority: "medium",
      owner: "juno",
      created: at({ days: 3 }),
      completed: at({ days: 2, hours: 20 }),
      details: {
        case: {
          source: "email",
          requester: { name: "Sam Okafor", address: "sam@lantern.example" },
          resolution:
            "Their admin had disabled third-party sign-in. Sent the steps to re-enable it.",
          resolvedAt: at({ days: 2, hours: 20 }),
        },
      },
    },
    {
      project: "support",
      number: 3,
      objective: "Write a help article on exporting invoices",
      status: "backlog",
      priority: "medium",
      owner: "juno",
      created: at({ days: 1 }),
    },
  ];
}

function resolveActor(actor, ids) {
  if (!actor) {
    return null;
  }

  return workActorSchema.parse(actor.type === "teammate" ? { ...actor, id: ids[actor.id] } : actor);
}

function resolveDetails(details, ids, handoff, attention) {
  const resolved = structuredClone(details ?? {});

  for (const breakdown of [resolved.breakdown].filter(Boolean)) {
    breakdown.proposedBy = resolveActor(breakdown.proposedBy, ids);
    breakdown.acceptedBy = resolveActor(breakdown.acceptedBy ?? null, ids);
    breakdown.items = breakdown.items.map((item) => ({
      ...item,
      owner: resolveActor(item.owner, ids),
    }));
  }

  if (resolved.standup) {
    resolved.standup.participants = resolved.standup.participants.map((participant) => ({
      ...participant,
      actor: resolveActor(participant.actor, ids),
    }));
    resolved.standup.answers = resolved.standup.answers.map((answer) => ({
      ...answer,
      actor: resolveActor(answer.actor, ids),
    }));
  }

  if (resolved.escalation) {
    resolved.escalation.to = resolveActor(resolved.escalation.to, ids);
    resolved.escalation.by = resolveActor(resolved.escalation.by, ids);
  }

  if (resolved.unblocker) {
    resolved.unblocker = resolveActor(resolved.unblocker, ids);
  }

  if (handoff) {
    resolved.handoff = { teammateId: ids[handoff], version: attention };
  }

  return projectTaskDetailsSchema.parse(resolved);
}

export function workTaskStatements({ flow, releaseBot, threads }) {
  const ids = teammateIds(releaseBot);
  const definitions = taskDefinitions({ threads });
  const taskStatements = [];
  const after = [];

  for (const definition of definitions) {
    const id = taskId(definition.project, definition.number);
    const projectId = PROJECTS[definition.project];
    const key = `${PREFIXES[definition.project]}-${definition.number}`;
    const attention = definition.attention ?? 1;
    const ownerTeammate = definition.owner ? ids[definition.owner] : null;
    const task = { ...definition, id };
    let conversationId = definition.thread?.conversationId ?? null;
    let runId = definition.thread?.runId ?? null;

    if (!definition.thread && (definition.run || definition.posts)) {
      conversationId = seedId("work", "task", definition.project, String(definition.number));

      const thread = buildThread(
        {
          id: conversationId,
          userId: OWNER.id,
          title: definition.objective,
          type: "task",
          projectId,
          createdAt: definition.started ?? definition.created,
          run: definition.run
            ? {
                ...definition.run,
                projectTaskId: id,
                teammateContextId: workContextId(definition.owner),
              }
            : null,
        },
        definition.run
          ? [
              { role: "user", content: definition.brief },
              { role: "assistant", content: definition.reply },
            ]
          : [],
      );

      runId = thread.runId;
      after.push(...thread.statements);
    }

    let outputIds;

    if (definition.output) {
      const [title, body] = definition.output;
      const outputStatements = document(
        title,
        body,
        conversationId,
        projectId,
        definition.completed ?? definition.updated ?? definition.created,
      );

      outputIds = [seedId("output", "work", title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"))];
      after.push(...outputStatements);
    }

    if (definition.posts?.length) {
      after.push(
        ...postStatements(
          conversationId,
          definition.posts.map(([kind, by, body, ago]) => post(kind, by, body, at(ago))),
        ),
      );
    }

    const completions = definition.completion
      ? [completion(task, conversationId, runId, { ...definition.completion, outputIds })]
      : null;

    if (completions) {
      after.push(goalRow(task, conversationId, OWNER.id));
    }

    taskStatements.push(
      insert("project_task", {
        id,
        project_id: projectId,
        workspace_id: WORKSPACE_ID,
        number: definition.number,
        key,
        kind: definition.kind ?? "task",
        objective: definition.objective,
        description: definition.description ?? null,
        priority: definition.priority,
        parent_task_id: definition.parent ? taskId(definition.project, definition.parent) : null,
        due_at: definition.due ?? null,
        reviewer: definition.reviewer ?? null,
        details: resolveDetails(definition.details, ids, definition.handoff, attention),
        acceptance_criteria: [],
        context: { links: [], notes: null },
        constraints: { forbiddenTools: [], notes: null },
        depends_on_task_ids: (definition.dependsOn ?? []).map((number) =>
          taskId(definition.project, number),
        ),
        require_approval_for: definition.approvals ?? [],
        status: definition.status,
        source: "user",
        blocked_reason: definition.blocked?.[0] ?? null,
        blocked_detail: definition.blocked?.[1] ?? null,
        stage_id: definition.project === "launch" ? (definition.stage ?? null) : null,
        flow_snapshot: definition.project === "launch" && definition.stage ? flow : null,
        runner: projectTaskRunnerSchema.parse({
          kind: "conversation",
          teammateId: ownerTeammate,
          model: SEED_MODEL,
          mode: definition.stage === "build" ? "build" : null,
        }),
        created_by_user_id: OWNER.id,
        assignee_user_id: definition.person ?? null,
        conversation_id: null,
        dispatch_task_id: definition.dispatch ? seedId("dispatch", id) : null,
        run_id: null,
        goal_id: null,
        completions,
        position: definition.number,
        token_budget: 200_000,
        tokens_spent: definition.status === "backlog" ? 0 : 6_400 * definition.number,
        created_at: definition.created,
        updated_at:
          definition.completed ?? definition.updated ?? definition.started ?? definition.created,
        started_at: definition.started ?? null,
        completed_at: definition.completed ?? null,
        attention_version: attention,
      }),
    );

    if (conversationId) {
      after.push(
        `UPDATE "project_task" SET "conversation_id" = ${sqlValue(conversationId)}, "run_id" = ${sqlValue(runId)}, "goal_id" = ${sqlValue(completions ? seedId("goal", id) : null)} WHERE "id" = ${sqlValue(id)};`,
      );
    }

    if (definition.dispatch) {
      after.push(
        insert("tasks", {
          id: seedId("dispatch", id),
          task_type: "project_task_dispatch",
          status: "queued",
          priority: 4,
          user_id: OWNER.id,
          project_id: projectId,
          task_data: JSON.stringify({ projectTaskId: id, projectId }),
          created_by: "user",
          created_at: definition.created,
          updated_at: definition.created,
        }),
      );
    }
  }

  const sequences = Object.fromEntries(
    Object.keys(PREFIXES).map((project) => [
      project,
      Math.max(
        ...definitions.filter((task) => task.project === project).map((task) => task.number),
      ),
    ]),
  );

  for (const [fromId, toId, kind] of [
    [taskId("support", 3), taskId("support", 1), "raised_from"],
    [taskId("launch", 5), taskId("launch", 3), "relates_to"],
    [taskId("support", 1), taskId("launch", 8), "relates_to"],
  ]) {
    after.push(
      insert("project_task_link", {
        id: `${fromId}-${kind}-${toId}`,
        workspace_id: WORKSPACE_ID,
        from_task_id: fromId,
        to_task_id: toId,
        kind,
        created_at: at({ days: 1 }),
      }),
    );
  }

  after.push(
    insert("user_resource_state", {
      resource_type: "task",
      user_id: OWNER.id,
      task_id: taskId("launch", 2),
      task_version: 1,
      read_at: at({ days: 2, hours: 4 }),
      dismissed_at: null,
    }),
    insert("approval", {
      kind: "connector",
      arguments_json: JSON.stringify({ channel: "#autumn-launch", text: "Tests are green" }),
      id: seedId("approval", "slack-post"),
      user_id: OWNER.id,
      run_id: threads.running.runId,
      completion_id: threads.running.conversationId,
      provider: "slack",
      operation: "chat.postMessage",
      connected_account_id: "acct_seed_slack",
      channel: "#autumn-launch",
      argument_digest: sha256Hex("chat.postMessage:#autumn-launch:Tests are green"),
      state: "pending",
      created_at: at({ minutes: 12 }),
      expires_at: ahead({ minutes: 48 }),
    }),
  );

  return { taskStatements, after, sequences, standupRunAt: NOW.toISOString() };
}

---
"@assistant/api": minor
"@assistant/app": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-component-workspaces": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@ngriffin_uk/polychat-utility-core": minor
---

Work now runs on tasks instead of chats. Teammates manage the work between them: they assign each other, ask for review, escalate, raise cases and propose hires.

- **Projects open on their tasks.** Each task has a key such as BIL-41, an owner, a priority, a due date and a thread. Switch between List, Board, Tree, Timeline and Triage views. Type a request into the box at the top and the project's lead routes it. Your old project conversations are now done tasks, with their history kept.
- **One memory per workspace.** A teammate employed in a workspace keeps one working memory and one set of connection grants across all its projects, carried over from what it already knew in each project.
- **Machines that are offline wait.** A task that needs one of your machines waits with "Waiting for a machine to come online" and starts by itself when the machine checks in.
- **Teammates hand work to each other.** A teammate can split a task into sub-tasks, assign them to other teammates, ask someone to review, block a task on the person who can unblock it, and escalate up its reporting line. Everything it does runs on the authority of the person responsible for it.
- **The lead handles the team's questions first.** When a teammate gets stuck on a question or a failed run, its manager looks at it before you do. It answers what it can from the mission, the plan and earlier answers, sends work back to run again, and only comes to you with one combined request for what it genuinely can't know. Approvals and spending still come straight to you.
- **Mention a teammate to wake it.** Write @name in a task thread and that teammate picks the task up. Teammates also wake when they're assigned work, asked to review or unblocked, and on their own heartbeat if you give them one.
- **Team page.** See who reports to whom, where each teammate runs, how often it wakes and what it has spent this month. Heartbeat rails show when each teammate ran, what it is running now and where it got stuck.
- **Budgets that brake.** Give each teammate a monthly budget. Inbox warns you at 80%, and at 100% the teammate pauses until you raise its cap.
- **Hiring by proposal.** You or a teammate can propose a hire with a reason, a manager and a budget. Owners and admins approve or reject it in Inbox.
- **Cases.** Problems found by people, by teammates or in imported issues land in a project's Triage, linked to the tasks that fix them. A case closes itself when those tasks are done.
- **Channels and email can open cases.** Connect a Slack channel, Telegram chat or email address to a project and choose "Open a case in Triage". Each new thread becomes a case that records who wrote in, and follow-ups in the same thread join it. The teammate drafts a reply, and you read, edit and send it from the case.
- **Standups.** Turn on a standup in project settings and pick the days, time and questions. Each standup is a task: you answer in Inbox from a draft built from your own activity, teammates answer from theirs, and the lead posts a summary, which can also go to a connected channel.
- **Initiatives.** Set your workspace's mission and initiatives, link projects to them and watch progress add up from their tasks. Teammates see why their work matters when they run.
- **Inbox and My tasks.** Inbox collects hires, budget warnings, standups, escalations and setup plans alongside task approvals. My tasks lists everything you own or are responsible for across workspaces.
- **Costs and Activity.** Each workspace shows spend by teammate, initiative, project and task for the period you pick, and a feed of everything people and teammates did. Usage and the audit log moved here from settings.
- **New workspace starts with a lead.** Give the workspace a name, a mission, links the lead can read and a monthly budget. The lead proposes a setup plan covering projects, team, budgets, wake rules, standups and first tasks, and nothing starts until you approve it. If anything fails while the plan is applied, nothing it made is kept and the plan shows why. Existing workspaces can hire a lead from the Team page.
- **Inbox on iPhone.** Approve hires and setup plans and answer standups from Inbox on iOS.

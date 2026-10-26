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
- **Tasks run where their owner runs.** A task follows its teammate's model onto Polychat, the sandbox or one of your machines. If that place can't take it, such as a machine that's offline, a sandbox with no repository or a provider that isn't ready, the task waits and says why instead of failing part way. Machine tasks start by themselves when the machine checks in.
- **Big tasks split into sub-tasks.** A teammate proposes how to break its task down, with owners and the order things must happen in. Once its manager or you accept that revision, the sub-tasks are created with their blockers and the ready ones start.
- **Teammates hand work to each other.** A teammate can split a task into sub-tasks, assign them to other teammates, ask someone to review, block a task on the person who can unblock it, and escalate up its reporting line. Everything it does runs on the authority of the person responsible for it.
- **The lead handles the team's questions first.** When a teammate gets stuck on a question or a failed run, its manager looks at it before you do. It answers what it can from the mission, the plan and earlier answers, sends work back to run again, and only comes to you with one combined request for what it genuinely can't know. Approvals and spending still come straight to you.
- **Mention a teammate to wake it.** Write @name in a task thread and that teammate picks the task up. Teammates also wake when they're assigned work, asked to review or unblocked, and on their own heartbeat if you give them one.
- **Team page.** See who reports to whom, where each teammate runs, how often it wakes and what it has spent this month. Heartbeat rails show when each teammate ran, what it is running now and where it got stuck.
- **Budgets that brake.** Give each teammate a monthly budget. Inbox warns you at 80%, and at 100% the teammate pauses until you raise its cap.
- **Hiring by proposal.** You or a teammate can propose a hire with a reason, a manager and a budget. Owners and admins approve or reject it in Inbox.
- **Cases.** Problems found by people, by teammates or in imported issues land in a project's Triage, linked to the tasks that fix them. A case closes itself when those tasks are done.
- **Channels and email can open cases.** Connect a Slack channel, Telegram chat or email address to a project and choose "Open a case in Triage". Each new thread becomes a case that records who wrote in, and follow-ups in the same thread join it. The teammate drafts a reply, and you read, edit and send it from the case.
- **Standups.** Turn on a standup in project settings and pick the days, time and questions. Each standup is a task: you answer in Inbox from a draft built from your own activity, teammates answer from theirs, and the lead posts a summary, which can also go to a connected channel. Skip a day with one click, or pause standups until a date for holidays.
- **Initiatives.** Set your workspace's mission and initiatives, link projects to them and watch progress add up from their tasks. Teammates see why their work matters when they run. The lead reviews the initiatives every week and can write you a daily brief, on the days and times you choose on its page.
- **One Inbox.** Hires, budget warnings, standups, escalations, setup plans, approvals, teammates waiting on you and tasks handed to you sit in a single list, newest decisions first. Cases stay in Triage. My tasks lists everything you own or are responsible for across workspaces.
- **Find tasks with ⌘K.** Search now finds tasks by key, such as BIL-41, or by what they're about.
- **Unstick a task.** If a queued or running task stops moving, open it and choose "Send to the queue again" from its menu.
- **Costs and Activity.** Each workspace shows spend by teammate, initiative, project and task for the period you pick, and a feed of everything people and teammates did. Usage and the audit log moved here from settings.
- **Setup works with what you've connected.** The setup plan only uses services you've already connected, and gives each project read or read-and-write access as it needs. Anything else the lead thinks would help is listed as a suggestion you can connect in Plugins, never a task.
- **New workspace starts with a lead.** Give the workspace a name, a mission, links the lead can read and a monthly budget. The lead proposes a setup plan covering projects, team, budgets, wake rules, standups and first tasks, and nothing starts until you approve it. If anything fails while the plan is applied, nothing it made is kept and the plan shows why. Existing workspaces can hire a lead from the Team page. Edit the plan yourself before approving it, or save a running team as a template and start the next workspace from it.
- **Inbox on iPhone.** Approve hires and setup plans and answer standups from Inbox on iOS.

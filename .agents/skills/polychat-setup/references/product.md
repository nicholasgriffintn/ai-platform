# Understand Polychat

Polychat combines personal **Chat** with collaborative **Work**. Start with the web app and API; add sandbox coding, training, desktop or native iOS only when needed.

Chat is conversation-first, with personal capabilities and rich experiences below `/chat`. Work organises projects inside workspaces, with shared conversations, instructions, sources, outputs and selected capabilities, and requires both the appropriate plan and current workspace membership. There is no third global mode.

## Move around

Switch modes with the toggle at the top of the page. Every sidebar starts with New chat and Search, then the same places: **Attention**, **Files** and **Teammates**. New chat follows the mode you are in. Chat and Work keep their own sidebars for conversations and projects; a project's sidebar offers a new conversation, Tasks, Files, Activity, and teammates and tools. Apps open from the library, from deep links or from the composer rather than from a sidebar item.

- **Files** holds everything you have given Polychat under Given and everything it has made under Made, personally or per project.
- **Attention** collects project work that needs you across every workspace, together with your own background tasks.
- **Poly** opens from the foot of every sidebar or with ⌘J, over whatever you are looking at. It operates the product — find a conversation, open a project, archive, pin, snooze, rename, summarise the open thread — and nothing else. It knows what you are looking at, re-checks your access before every action, and cannot approve tool requests, run connectors or act for anyone else. It needs a signed-in account with cloud storage.

A project opens on its conversations, with Chat, Tasks and Files as tabs and a gear beside them. Everything that configures the project — the brief, the model tier, what it knows, what runs on a schedule, its coding environment, its attached teammates and tools — lives behind that gear.

In a project conversation the composer carries an **As task** toggle: what you type is filed as a project task rather than asked now, and the task remembers the conversation it came from. Coding conversations keep their task-type control instead.

When a conversation works something out you will want again, ask for it to be saved as a skill. Polychat agrees the name and instructions with you, then writes a skill you load by name later — into the project when the conversation belongs to one, otherwise into your own library.

Memory can be kept as documents rather than a hidden store. Choose **Documents** as your memory provider and everything Polychat remembers lands in Files under Memory as plain text you can read, edit and delete, with every save kept as a revision.

## Choose how work runs

- Use a conversation for interactive work, an experience for a richer workflow, a recipe for reusable configured work, and a project task or flow for durable agent execution and hand-offs.
- Hire a teammate from a built-in role, describe the job in your own words, or both. Every teammate is a **colleague** or a **bot**: a colleague can file tasks and add to memory, while a bot answers and reports and the server refuses those writes whatever its tool list says. Reads run on their own; anything that writes to another system waits for your approval.
- Skills supply instructions and teammates supply a brief and capability requests. Neither grants permission — their runner still needs access to everything they use.
- Keep connector installations and credentials attributable to the person running the work. Project membership does not grant another member's external account.
- Use the project's **Default model tier** for project conversations and coding runs. Explicit request tiers or models override it; it is not a spending cap.
- Treat **sources** as durable inputs and **outputs** as durable results. Project scope adds collaboration; conversation links add provenance.

Model and capability readiness is a short-lived preflight, not an execution guarantee, and the server checks current authority again when work starts. Removing an account or provider key never silently replaces your selected model: Polychat keeps it, blocks sending and asks you to refresh access or choose another. Changing models affects the next run, keeps compatible attachments and stored history but resets model-specific response settings; finish or cancel an active run, approval or question first. Use a branch or a second opinion for comparisons, so each result keeps its own model attribution and usage identity.

## Follow work in progress

Each accepted stored task has one run identity and an authoritative state separate from its visible messages. An interrupted connection recovers the same task, including saved tool and partial assistant messages, and keeps observing it until attention or completion is reported; clients replace local state with an authoritative snapshot if updates were missed. Repeated or late delivery cannot duplicate work or reopen a finished task. Queue-dispatched project tasks continue independently of the request that started them, personal stored Chat is best-effort after a connection loss, and local-only Chat is private to the device with no server recovery.

Stop targets an exact task and attempt. A stop request appears before execution has actually stopped, and a tool or provider call already in progress may finish first. Temporary rate limits, timeouts and provider outages can trigger one visible repeat of a model call, with no more than two across a run; invalid input, credentials, permissions, policy, conflicts and usage limits do not retry. If an external write loses its response, Polychat says it may have completed: explicitly idempotent operations can repeat once, while other writes need you to check the external system.

Questions, tool approvals and stage reviews have their own durable controls rather than being inferred from assistant prose, and remain recoverable for seven days. Task detail shows a durable activity timeline that survives reopening and switching devices, keeping proposed outcomes separate from actual runs and distinguishing waiting, tool failure, interruption, cancellation and completion. Raw tool payloads and private reasoning stay out of it. A task keeps the flow it started with and shows each stage as proposed, executing, completed, failed, interrupted or abandoned from actual run evidence; retries appear as separate attempts with their own provenance. Polychat retries a failed model-only stage at its existing boundary but asks you to reconcile an external provider when an approved write may already have happened.

Stored conversations compact older history when requested or when context pressure requires it, and each later model step checks pressure again. Large tool results are shortened only in the model prompt and remain stored for authorised retrieval. Context views show attached sources, effective skills, the active summary, omissions and window usage, and say whether usage came from the provider or is an estimate.

Usage is charged to the runner in monthly credits. A stored run shows its reserved estimate separately from recorded consumption and settlement across all attempts: a reservation is not a charge, and missing provider usage appears as unknown rather than zero. Workspace owners and administrators can review attributed spend without a shared allowance. Read [usage](operations/loop-cost-controls.md) for enforcement and reporting.

## Organise and schedule

Open a conversation's actions menu to pin it, mark it unread, snooze it until tomorrow or the next agent response, or move it into a group. Pin, unread and snooze are personal even in a shared project; active snoozes leave ordinary lists and Attention but stay searchable. A conversation belongs to at most one group, and the sidebar lists each group as its own section. Personal groups belong to you; project groups are shared within that project, with owners and administrators managing which exist and members moving conversations between them. None of these controls changes project access.

Schedule a recipe from its capability controls or a project's Scheduled recipes surface. The installation owns the saved prompt, configuration and trigger, and only its owner can manage the schedule or supply personal connector credentials. Each occurrence produces its own attributable conversation, so durable context belongs in recipe configuration or project Sources rather than in an earlier conversation's history.

Attention brings operational work from every workspace you can access into one view. Filter by needs approval, needs input, in review, failed or stalled, running or recently completed, then narrow by workspace, project, owner, type and date; the URL retains those filters. Items come from task interaction state and sandbox-run Activity, never assistant prose. Opening one returns you to its existing surface with the same authority as before, and losing membership removes the item.

## Coding work

**Project Workbench** is the responsive presentation for coding-enabled project conversations. It is not a third mode or a separate execution environment: it keeps the conversation as the durable entry point and presents its sandbox work through Conversation, Activity, Changes, Files and Proof, with Preview available for declared network services.

Activity combines the conversation's agent trace with the selected run's plans, model and tool activity, commands, approvals, instructions, validation, errors and outcome, using recorded summaries rather than hidden reasoning and redacting recognisable credentials. Its runner can add an instruction, request continuation, pause at the next safe boundary, resume, cancel or resolve a pending command approval; other members can review without inheriting those controls. Changes and Files present authorised run evidence, not project Sources. Proof stays truthful after reload — a failed or cancelled run cannot look successful because optional evidence is absent — and links to large logs and diffs through the authorised Output path.

Choose a delivery policy when connecting the repository. New environments recommend a review branch and pull request; you can instead leave changes uncommitted, prepare only a review branch, target an existing non-protected branch, or supply local preparation instructions. Remote delivery happens only after validation and a separate approval from the person who started the run, showing repository, action, branches, commit and validation result. Polychat rechecks that person's GitHub access at execution and refuses direct delivery to `main`, the default branch or a protected branch.

Environment setup is optional. Configure it in project settings or use the repository-owned `.polychat/environment.json` convention to declare setup commands, lighter resume commands, required runtimes and package manager, a timeout and run-scoped services. Commands containing inline credentials are rejected, and risky commands still follow the run's approval policy. After a successful full setup Polychat can save a private environment snapshot, reused by the same project member only while the project, installation, repository revision, lockfiles, setup definition and platform version still match; owners and administrators can delete it or request a rebuild.

Declared services start in dependency order before agent work, with health checks, bounded restarts and redacted logs. The runner can start, restart or stop one without gaining a general terminal, and services stop with the run rather than becoming persistent daemons. A healthy service with a declared port can receive a short-lived preview on an isolated, opaque origin, checked against current membership, run state, service health and the exact port. Access expires after five minutes and ends sooner when revoked or when the run or service stops. Preview content is your untrusted application: the gateway passes no Polychat credentials, blocks external redirects and broad embedding, and never reveals the container address. You can mark a region or element and send bounded feedback as an ordinary instruction to the same run.

Project membership grants project access, not somebody else's execution authority. The runner needs current sandbox and repository authority, connector credentials stay personal, and approvals remain separate exact actions.

iOS can notify you when project work needs input or approval, is ready to review, completes or stops. Lock-screen text stays deliberately generic; opening it reloads the exact conversation, task or run through your current membership. Notification permission and Polychat registration are separate states, preferences apply per account and registrations per installation, and an old notification cannot reveal stale detail or restore a finished action.

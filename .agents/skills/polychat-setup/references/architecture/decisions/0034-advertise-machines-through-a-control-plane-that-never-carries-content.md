# ADR 0034: Advertise machines through a control plane that never carries content

Status: Implemented in the API, shared clients and desktop shell.

## Problem

A desktop runtime is useful to every signed-in client belonging to the same account, but the control plane must not become a tunnel for local network access or conversation content. Clients also need a stable way to distinguish one advertised machine from another and to stop showing stale machines after a desktop exits.

## Decision

Store one account-scoped machine record per stable desktop machine ID. A heartbeat may contain only the user-visible machine label, platform, app version, runtime readiness, model metadata and declared capabilities. It never contains endpoint addresses, pairing secrets, prompts, responses, model bytes or workspace identifiers. The API authorises every read and write through the current account and never exposes machines through workspace routes.

Advertise on desktop launch, runtime changes and a two-minute interval. Derive `online` at read time from a five-minute `lastSeenAt` window rather than persisting presence. Sign-out and disabling the account setting forget the machine; an ungraceful exit becomes offline when the window expires.

Shared activity is a separate, opt-in channel, not part of the heartbeat. When the person switches it on in the desktop app, the desktop core reads the local sources itself and sends only summaries to `PATCH /machines/{machineId}/activity`. History files and transcripts never leave the device. Page addresses and session excerpts leave only behind their own switches, and the API may read public pages from those addresses. The API stores those lines as the person's own Discover documents, keyed by account, machine and source, replaces them on every send, and deletes them when the person turns sharing off, forgets the activity or forgets the machine. Advertising a machine and sharing its activity are independent settings.

The desktop keeps its local discovery source authoritative for itself, including while offline. Other signed-in clients fetch the account machines and merge ready model metadata into the catalogue with `machineId`. This advertises availability only; the control plane does not route execution, and clients must not send a machine model's prompt to the hosted API when no local execution path exists.

## Amendment: workspaces may use a member's desktops

A person can switch on "Let my workspaces use my desktops", which is off by default and has no effect while their desktops are hidden. Their online desktops then serve Work task runs for any workspace they belong to, for teammates whose model would otherwise run on hosted API models. Only agents signed in with a subscription are chosen, and the run owner's own desktops come first. A shared run works in a `Polychat Work/<workspace>` folder the desktop creates, never in the person's own granted folders, and every action outside the agent's auto-accepted edits asks for approval in the task's Inbox. Only the machine's owner may claim or report its runs; other members can start, follow, answer and cancel them, and the coordinator is keyed by the owner. Advertising itself stays account-scoped: shared machines are resolved for execution, never listed on workspace routes.

A shared run starts without the member's own agent settings and instructions, so their personal preferences never shape workspace work. It reaches Polychat only through `/mcp/work`, authenticated by a token minted for that one task run: it names the person, project, teammate context and conversation, expires within hours, and offers only the Work task tools, run with the teammate's authority and policy. A desktop runs at most three jobs at once, and routing passes over a desktop that is full.

## Consequences

Browsers can show which account machines and models are currently reachable without learning how to reach a customer's network. The API has a small, inspectable persistence boundary and can forget a machine without touching conversations or provider credentials.

Remote machine models can be displayed before remote execution is available, so clients mark them non-executable and keep the execution guard explicit. The heartbeat interval is shorter than the freshness window, but network loss and process termination still leave a bounded period in which a machine appears online.

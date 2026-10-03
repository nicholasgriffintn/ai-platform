# Enable browser and computer use

Use **Use Computer** (`use_computer`) for both providers. Choose `openai` to run a managed browser task with a personal or workspace OpenAI connection, or `hosted` to operate the built-in computer in a durable teammate context. Both use the computer capability and shared tool contract; each adapter keeps its own execution and approval rules.

## Configure

- **Personal account:** add an OpenAI API key in provider settings. Platform credentials do not enable this capability.
- **Workspace account:** connect **OpenAI** under Work › Models › Governance. Project conversations prefer that workspace connection, then fall back to the personal OpenAI key when no workspace key is configured. The OpenAI-compatible endpoint connection does not provide Agents API access.
- **Database:** apply `0056_browser_sessions` through the usual D1 migration workflow before deploying this change. No new worker, binding or package dependency is required.
- **Built-in computer:** configure the existing `COMPUTER_WORKER` binding and use a premium account. An OpenAI key is unnecessary for this provider.
- **Access:** enable Use Computer in the tool selection or teammate configuration. Project conversations also require the project tool grant. Workspace membership and conversation access remain required. `/computer-use/availability` lists configured providers, their modes and supported operations.
- **OpenAI account:** confirm the connected account can create Agents API sessions with computer use and the chosen model. The default is `gpt-6-astra`. Checking the connection verifies read access to the Agents API, while session creation can still require additional permissions.

## Run

Start a bounded task with `use_computer`, `provider: "openai"` and `operation: "start"`, optionally specifying an OpenAI model and allowed domains. Open the browser card to review the destination before allowing website access. **Website approval permits actions on that origin** for the requested task. It does not ask for approval before every click or consequential change.

Start or inspect the built-in computer with `provider: "hosted"`, then use `observe`, `read`, `check`, `input` or `wait`. Existing control calls without a provider continue to select `hosted`. Typing and committing keys require supervised takeover. Stop or delete the built-in computer through its existing user controls.

Enter sign-in values only in the browser card. Every field is masked and cleared after submission. Values go through the dedicated OpenAI authentication event, with no automatic replay, and stay outside chat messages, tool arguments, mutation caches and stored session records. Cancel sign-in if you cannot verify the destination. Passkeys and QR-code sign-in are unsupported by the provider flow.

Watch the current screenshot and activity, then select **Continue conversation** when the task ends. The assistant retrieves the result with `inspect`. Use **Stop task** to cancel work and **Close browser** to cancel outstanding work and delete the provider session. Close browsers before deleting conversation history or replacing their OpenAI connection. Deleting local history does not delete remote OpenAI sessions.

## Recover

- **Startup was not confirmed:** refresh the same browser card. An atomic creation claim prevents repeated tool calls from launching another task, and session metadata locates a task that OpenAI accepted before the connection failed. Recovery scans at most 2,000 recent sessions. Reconcile older sessions in the provider account when that bound is reached.
- **An approval was not confirmed:** refresh the current request before submitting again. Responses to stale request IDs are rejected. Submitted values are cleared even when the acknowledgement is lost.
- **Credentials were removed or replaced:** restore the original provider account to stop or close its sessions. A session stays pinned to its original credential source and never switches to platform credentials or another account.
- **Conversation scope or membership changed:** restore the original authorised scope or close the resource in the provider account. Another project member cannot inspect or approve a browser owned by someone else.

## Extend

Add adapters to the existing computer capability factory and shared `computer-use` contracts. Implement `ComputerSessionProvider` for managed tasks or `ComputerProvider` for interactive control, and declare supported operations without pretending both modes offer identical controls. Keep ownership, credential authority and browser approvals in the `computer-use` application module; retain durable worker leases in the teammate module. Reuse the shared OpenAI Agents client for protocol changes that apply to browser and sandbox sessions. Keep polling and authenticated UI operations in `library-react` and `component-shell`, with controlled forms in `component-conversation`.

Follow the [computer-use guide](https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use), [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview) and [configuration guide](https://developers.openai.com/api/docs/guides/agents-api/configuration) when updating this beta integration.

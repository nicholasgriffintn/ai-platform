# Enable hosted browser tasks

Use **Use Browser** (`use_browser`) when a chat or teammate needs to read or act on a website through the OpenAI Agents API. The existing computer worker provides its own supervised desktop through `use_computer`. Hosted browser sessions use a separate provider capability because OpenAI manages the browser actions and approval flow.

## Configure

- **Personal account:** add an OpenAI API key in provider settings. Platform credentials do not enable this capability.
- **Workspace account:** connect **OpenAI** under Work › Models › Governance. Project conversations prefer that workspace connection, then fall back to the personal OpenAI key when no workspace key is configured. The OpenAI-compatible endpoint connection does not provide Agents API access.
- **Database:** apply `0056_browser_sessions` through the usual D1 migration workflow before deploying this change. No new worker, binding or package dependency is required.
- **Access:** enable Use Browser in the tool selection or teammate configuration. Project conversations also require the project tool grant. Workspace membership and conversation access remain required.
- **OpenAI account:** confirm the connected account can create Agents API sessions with computer use and the chosen model. The default is `gpt-6-astra`. Checking the connection verifies read access to the Agents API, while session creation can still require additional permissions.

## Run

Start a bounded task with `use_browser`, optionally specifying an OpenAI model and allowed domains. Open the browser card to review the destination before allowing website access. **Website approval permits actions on that origin** for the requested task. It does not ask for approval before every click or consequential change.

Enter sign-in values only in the browser card. Every field is masked and cleared after submission. Values go through the dedicated OpenAI authentication event, with no automatic replay, and stay outside chat messages, tool arguments, mutation caches and stored session records. Cancel sign-in if you cannot verify the destination. Passkeys and QR-code sign-in are unsupported by the provider flow.

Watch the current screenshot and activity, then select **Continue conversation** when the task ends. The assistant retrieves the result with `inspect`. Use **Stop task** to cancel work and **Close browser** to cancel outstanding work and delete the provider session. Close browsers before deleting conversation history or replacing their OpenAI connection. Deleting local history does not delete remote OpenAI sessions.

## Recover

- **Startup was not confirmed:** refresh the same browser card. An atomic creation claim prevents repeated tool calls from launching another task, and session metadata locates a task that OpenAI accepted before the connection failed. Recovery scans at most 2,000 recent sessions. Reconcile older sessions in the provider account when that bound is reached.
- **An approval was not confirmed:** refresh the current request before submitting again. Responses to stale request IDs are rejected. Submitted values are cleared even when the acknowledgement is lost.
- **Credentials were removed or replaced:** restore the original provider account to stop or close its sessions. A session stays pinned to its original credential source and never switches to platform credentials or another account.
- **Conversation scope or membership changed:** restore the original authorised scope or close the resource in the provider account. Another project member cannot inspect or approve a browser owned by someone else.

## Extend

Add providers through the browser capability registry and `BrowserSessionProvider` interface. Keep local ownership, credential authority and approval validation in the browser-session application services, and keep native protocol contracts in `packages/schemas`. Reuse the shared OpenAI Agents client for protocol changes that apply to browser and sandbox sessions. Keep polling and authenticated UI operations in `library-react` and `component-shell`, with controlled forms in `component-conversation`.

Follow the [computer-use guide](https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use), [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview) and [configuration guide](https://developers.openai.com/api/docs/guides/agents-api/configuration) when updating this beta integration.

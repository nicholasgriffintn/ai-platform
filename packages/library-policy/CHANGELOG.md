# @ngriffin_uk/polychat-library-policy

## 0.4.0

### Minor Changes

- 91c7d3d: Choose what Polychat can reach for on its own.

  - **Capabilities settings.** A new Capabilities section in Customise Chat has switches for web search and for documents and connected apps. Turn one off and Polychat stops using it by itself, including deep research for web search. Tools you pick in the composer, or that a project, teammate or recipe sets up, still work.
  - **Chat history means chat history.** Searching your earlier chats now follows the chat history switch in Memories. Turn it on if you want Polychat to look back through your previous conversations.

## 0.3.0

### Minor Changes

- 7bec25b: Add Polychat Benchmarks: GeoGuess, Countdown, Fermi Bets, Long Odds, Hamster Wheel and Strudel Groove, run on one engine for official, personal and workspace scopes. Results at `/benchmarks` show intervals, Artificial Analysis indexes with attribution, measured cost and a medal table, people can play the auto-scored benchmarks and vote on blind pairs, the Benchmarks app runs them against your own models and keys, and the model selector previews each model's standings.

## 0.2.0

### Minor Changes

- 67b52ed: Let people approve a Poly write once and for all, for one destination. When Poly at the assistant level waits on a write with a known destination, the approval card offers "Always allow here". The server derives the tool and destination from the stored pending call and keeps the approval on the Poly context for thirty days, where a Cedar condition lets matching writes run unattended. Sends, spending, deletes, credentials and exports still ask every time. Approvals are listed in Poly's autonomy menu and can be revoked there.
- 07290f2: Add a teammate autonomy dial. A teammate context can be an observer, an assistant or a partner, enforced by Cedar over each call's effect class: observers only read and draft, assistants ask before writes, partners write within their grants, and sends, spending, deletes, credentials and exports always ask. Poly starts as an assistant and its overlay can change the level. Run triggers now reach tool availability and execution, so Poly's navigation gate holds there too.

### Patch Changes

- 6966643: Grant selected actions from existing connectors directly to projects through Plugins, without creating a recipe. Reuse personal accounts, the connector catalogue, project capabilities and existing execution approvals. Preserve exclusions and narrower recipe permissions.

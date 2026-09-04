# Understand Polychat

Polychat combines personal **Chat** with collaborative **Work**. Start with the web app and API; add sandbox coding, training or native iOS only when needed.

Chat is conversation-first, with personal capabilities and rich experiences below `/chat`. Work organises projects inside workspaces, with shared conversations, instructions, sources, outputs and selected capabilities. Work access requires the appropriate plan and current workspace membership. There is no third global Apps or Recipes mode.

## Choose how work runs

- Use a conversation for interactive work, an experience for a richer workflow, a recipe for reusable configured work, and a project task/flow for durable agent execution and hand-offs.
- Configure skills and saved agents in the capability library. Skills supply instructions; agents supply personas and capability requests. Their runner still needs access to everything they use.
- Keep connector installations and credentials attributable to the person running the work. Project membership does not grant another member's external account.
- Use the project's **Automatic model preference** for its default routing tier. Explicit request tiers or models override it; it is not a spending cap.
- Treat **sources** as durable inputs and **outputs** as durable results. Project scope adds collaboration; conversation links add provenance.

For models that support it, the **Processing** selector offers Automatic, Standard and Fast with catalogue pricing. Changing the model clears an explicit choice; web Chat, Work and iOS use the same contract.

## Find conversations and results

Conversation lists can group ordinary chats and task conversations. In a saved remote conversation, **Branches** opens related threads without copying history. Personal branches remain owner-scoped; project branches remain within the same membership-authorised project. Local-only and iOS navigation do not gain this web branch browser.

An interrupted connection may recover the saved answer. Stop explicitly to request cancellation; changing views is not a stop action. Questions, tool approvals and stage reviews have distinct durable controls rather than being inferred from assistant prose.

Usage is charged to the runner in monthly credits. Workspace owners and administrators can review attributed spend without creating a shared allowance. Read [usage](operations/loop-cost-controls.md) for enforcement and reporting, or [architecture context](architecture/context.md) for the implementation map.

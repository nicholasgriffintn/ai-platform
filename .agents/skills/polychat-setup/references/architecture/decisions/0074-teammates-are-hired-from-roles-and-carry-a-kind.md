# ADR 0074: Teammates are hired from roles and carry a kind

Status: Accepted.

Creating a saved persona meant filling in an empty editor: a name, a system prompt, a model, a tool list and a mode, before knowing what any of them should be. People who would benefit most from a teammate are the least able to write its brief, so the feature stayed unused. Peers solve this by hiring from a catalogue of roles rather than configuring an agent, and by saying in one sentence what a teammate is allowed to do on its own.

## Decision

A teammate is hired from a built-in role, from a job description, or from both. Roles live in `packages/schemas` so the web, the API and any later client read the same catalogue: each carries a title, a category, a kind, a summary, a brief and its suggested tools and mode. Hiring resolves the role into an ordinary teammate record, so nothing downstream needs to know a role existed. A job description is appended to the role's brief rather than replacing it, and a teammate hired from a description alone must be named.

Every teammate has a `kind` of `colleague` or `bot`. A colleague is the existing behaviour. A bot answers and reports: it cannot file tasks or write to memory. The kind is stored on the record, editable afterwards, and enforced server-side in two places. Hiring and saving filter the teammate's own tool list, and preparing a run sends `denied_tools`, which the permission checker refuses whatever the mode allows and whatever the caller asks for. A client cannot restore a denied tool by naming it in `enabled_tools`.

"Reads run on their own. Anything that writes to another system waits for your approval." is stated once in the contracts and shown wherever a teammate is hired or edited, rather than being re-worded per surface.

## Trade-off

The role catalogue is curated code, not data: adding a role is a release. That keeps briefs reviewable and versioned with the product, at the cost of not being editable by an operator. Bot restrictions are a tool-level refusal, so a bot given a custom MCP tool that writes elsewhere is still bounded only by the ordinary approval rules.

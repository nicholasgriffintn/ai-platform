# ADR 0023: A saved agent is a chat completion with a persona

## Status

Accepted

## Context

`POST /agents/:id/completions` built its own system prompt: the agent's `system_prompt` field, plus few-shot examples concatenated onto the end as indented prose, passed to the completions service as `system_prompt`.

A caller-supplied `system_prompt` short-circuits prompt assembly. So an agent conversation received no safety standards, no skills roster, no memory, no formatting rules, no channel context, no instruction precedence and no model metadata. It also received a tool set of its own — approval, ask-user, MCP and team delegation — with no access to function tools or skills at all.

This is the shape ADR 0021 removed from Council, where a prompt mode returned early from `getSystemPrompt` and silently denied those conversations everything the platform provides. The same bypass was live on a different route, and reads as intentional until you look for the skills roster and find it missing.

Layering the agent's text into the generated prompt is the obvious fix, but doing it by widening the meaning of `system_prompt` would break the other callers of that field. For a caller of an OpenAI-compatible completions API, a system prompt that arrives with our safety standards, skills roster and session config appended is not what was asked for.

## Decision

Separate the two ideas. `system_prompt` keeps its meaning: a full override, for callers who want to replace our prompt. A new `persona` carries an identity to be layered into the generated one.

A persona is a name, instructions, and examples. It renders as a `<persona>` section between the behaviour rules and the response style, and sits in the instruction precedence order where an identity belongs: below safety standards, channel context and behaviour, above response style and formatting. Everything the platform guarantees still applies.

A saved agent becomes a persona plus a tool scope. `buildAgentPersona` reads the agent record; few-shot examples become structured examples in the section rather than string concatenation, which also means a malformed example is dropped rather than pasted in.

Collapse the coding prompt into the standard assembler while doing this. It was the same assembly with an extra coding-conduct section and two omissions that were drift rather than decisions: a coding model in agent mode received no agent guidelines, and one answering over SMS received no channel context.

## Trade-offs

An agent conversation now costs more tokens per turn than it did, because it carries the prompt every other conversation carries. That is the price of an agent that knows about safety standards and can load a skill.

Agent authors lose the guarantee that their text is the whole prompt. An agent written against the old behaviour, relying on our prompt being absent, will behave differently — its instructions are now one section among several, and outranked by safety standards. Authors who genuinely want the old behaviour can still send `system_prompt` directly.

`persona` is an internal field rather than part of the public request schema. Exposing it would let API callers layer an identity without replacing the prompt, which is probably the right long-term shape, but it is a public contract and belongs in its own change.

The persona section is model judgement like any other instruction. An agent whose instructions contradict the response style will be resolved silently by the precedence order rather than reported, which is the same trade the precedence block already makes everywhere else.

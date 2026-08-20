---
"@assistant/api": minor
---

Saved agents now run on the platform prompt. An agent's instructions and few-shot examples become a persona layered into the generated system prompt, so an agent conversation gets safety standards, the skills roster, memory, formatting, channel context and model metadata instead of the agent's own text alone.

The coding prompt collapses into the standard assembler, which fixes a coding model in agent mode receiving no agent guidelines and a coding model on SMS receiving no channel context.

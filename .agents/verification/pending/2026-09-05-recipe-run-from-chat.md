# Running a recipe from chat produces the recipe's result

- **Change:** a `trigger_recipe` run no longer replaces the recipe's run instruction with the user's phrasing, `load_skill` is now enabled whenever the prompt advertises skills, and the recipe answer is no longer duplicated inside the tool result payload.
- **Surfaces:** API (chat completions, recipe execution), web conversation thread.
- **Prerequisites:** none.
- **Risk if wrong:** asking Polychat to run a saved recipe returns a refusal about missing skills or tools instead of the recipe output, or shows the same answer twice in the tool card.
- **Commits:** pending.

## Verify

- [ ] In chat, ask "Run my Daily AI News Briefing recipe." and confirm the tool card returns the briefing itself, not a message about skills or unavailable tools.
- [ ] Expand "Raw response" on that tool card and confirm the briefing text appears once, above it, and not again inside the JSON.
- [ ] Ask the same recipe with a real instruction ("run my news briefing, focus on chips") and confirm the answer follows the instruction.
- [ ] Trigger a recipe that has a saved schedule prompt with no extra input and confirm the scheduled prompt still drives the run.

**Stop and report if:** the recipe run answers the request to run a recipe instead of doing the recipe's work, or reports that a skill could not be loaded.

## Follow-up: Anthropic history with tool-only assistant turns

- **Change:** Anthropic history no longer emits empty text blocks, and an assistant turn left with no content (tool call only, or thinking only) is dropped rather than sent as an empty block list.
- **Risk if wrong:** any Anthropic conversation that includes a tool call fails on the next turn with "text content blocks must be non-empty".

- [ ] Continue a conversation on an Anthropic model after a turn that called a tool and produced no visible text, and confirm the next turn streams normally.
- [ ] Confirm assistant turns that did produce text still show that text on reload.

## Follow-up: recipe runs are grounded and stay in their declared tool scope

- **Change:** an installed recipe run now receives the recipe's own description and steps plus an instruction to build the answer only from what its tools returned. A recipe execution also keeps exactly the tool set the recipe declared — no goal, memory or skill tools are layered on, and the skills catalogue is not advertised.
- **Risk if wrong:** a recipe answers from the model's own knowledge and presents invented figures as current news; or a run loses a tool it legitimately needs.

- [ ] Run a web-search recipe and confirm every claim in the output traces to a cited source, with no invented product names, funding figures or dates.
- [ ] Run a recipe whose search returns nothing useful and confirm it says so rather than composing an answer anyway.
- [ ] Confirm the run's server log shows no "requires approval in build mode" error for `set_goal` or memory tools.
- [ ] Confirm the run does not call `load_skill` and its answer carries no note about being unable to trigger a recipe.
- [ ] Run a recipe that uses a connector and confirm the connector tool still works.

**Stop and report if:** a briefing contains claims absent from its tool results, or a recipe loses access to a tool it declares.

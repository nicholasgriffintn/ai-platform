# Set up standing work by describing it

- **Change:** A `create_automation` tool installs a recipe with a schedule from a description of when it should run and what it should do. It says the schedule back in words before saving, and reports when the automation cannot run yet because a service is not connected. Automation results can now be delivered to Slack and Telegram as well as SMS.
- **Surfaces:** API. The existing automation surfaces list and control it unchanged.
- **Prerequisites:** None. No schema change.
- **Risk if wrong:** An automation scheduled at the wrong time, one installed into a project by someone who cannot enable recipes there, or one that silently never runs.
- **Commits:** This branch.

## Verify

- [ ] Ask for something to run every weekday morning. Confirm the reply states the schedule in words, that it matches what you asked for, and that the automation appears in Teammates and tools with that schedule.
- [ ] Ask for one whose recipe needs a connector you have not connected. Confirm the reply says it cannot run yet rather than implying it will.
- [ ] Ask for one in a project as a member who cannot enable recipes there. Confirm it is refused.
- [ ] Ask for delivery to Slack without saying where. Confirm it asks rather than saving a half-configured trigger.
- [ ] Pause the automation from the library and confirm it stops running.
- [ ] Wait for the first scheduled run and confirm it runs once, at the stated time.

**Stop and report if:** the schedule saved differs from the schedule read back, or an automation is installed into a project the caller cannot enable recipes in.

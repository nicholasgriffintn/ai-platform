# Save the way something was done as a skill

- **Change:** Ordinary conversations gain a `save_skill` tool. It writes a SKILL.md from a name, a description and instructions, saving into the project when the conversation belongs to one and into the person's library otherwise. Poly does not get it, because the meta scope takes only meta tools.
- **Surfaces:** API only. The saved skill appears in the existing library and loads by name.
- **Prerequisites:** None.
- **Risk if wrong:** A skill saved into the wrong scope, a project member without admin rights publishing to a project, or a name colliding with a built-in skill.
- **Commits:** This branch.

## Verify

- [ ] In a personal conversation, ask for what just happened to be saved as a skill. Confirm it agrees the name and instructions with you first, then that the skill appears in Teammates and tools and loads by name in a later conversation.
- [ ] Do the same in a project conversation as a workspace owner or admin. Confirm the skill is attached to that project and not to your personal library.
- [ ] Try it in a project conversation as an ordinary member. Confirm it is refused rather than silently saved somewhere else.
- [ ] Ask for a skill named after a built-in one. Confirm the name is refused with a message naming the clash.
- [ ] Confirm Poly is not offered the tool and cannot call it.

**Stop and report if:** a skill is published to a project by someone who cannot manage that project, or a saved skill's instructions differ from what was agreed in the conversation.

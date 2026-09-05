# Shared motion foundation

- **Change:** Added shared motion timing, easing, distance and stagger primitives and applied them to a drawer, active execution and welcome entrance.
- **Surfaces:** Responsive sidebar, streaming activity row and Chat/Work welcome screens.
- **Prerequisites:** A narrow viewport and a conversation that can stream a response.
- **Risk if wrong:** Motion may feel inconsistent, imply progress that is not known, or remain distracting when reduced motion is requested.
- **Commits:** None yet.

## Verify

- [ ] At a narrow viewport, open and close the sidebar. Confirm the drawer decelerates cleanly, remains dismissible by keyboard and does not leave content trapped after closing.
- [ ] Start a response and confirm the activity marker communicates only that work is active. Confirm the written status remains the source of truth and the marker stops when activity ends.
- [ ] Open an empty Chat or Work conversation and confirm the title and description enter once with a restrained stagger rather than replaying during ordinary interaction.
- [ ] Enable the operating system's reduced-motion preference and repeat all three checks. Confirm the drawer changes without a perceptible transition, the activity marker is static and visible, and welcome content appears without movement.
- [ ] If animated pets are enabled, confirm idle flourishes stop while work is active and the pet setting still independently disables pet animation.

**Stop and report if:** Motion obscures state, suggests measurable progress, traps focus, continues under reduced motion, or overrides the pet animation setting.

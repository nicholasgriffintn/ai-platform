# Task notifications can be turned on from the desktop window

- **Change:** how a device delivers task notifications is now supplied by the host. The web keeps browser permission and web push registration; the desktop turns the account preference on directly, because the running window raises the notification and badges the icon itself. The desktop badge follows the same switch.
- **Surfaces:** desktop and web, on the Work overview where the settings card sits.
- **Prerequisites:** the account must be on a plan that exposes task notification settings. Web push still needs the server's public key configured.
- **Risk if wrong:** the desktop shows notification controls that do nothing, the web loses its permission prompt or registration retry, or turning the switch off on one host silently stops notifications on the other.

## Verify

- [ ] In the desktop window, open Work. Confirm the task notifications switch is usable, turn it on, and confirm the four category switches become usable.
- [ ] With a task waiting on you, confirm the desktop raises a system notification for an enabled category and badges the application icon with the unread count.
- [ ] Turn one category off in the desktop window and confirm no further notification arrives for that category while the others still do.
- [ ] Turn the switch off in the desktop window and confirm the icon badge clears and no further notifications arrive.
- [ ] Confirm the desktop status line names the system settings as the place to allow notifications, and that it does not claim a browser permission.
- [ ] In a browser, open Work and confirm the switch still asks for browser permission, registers, and reports "Browser permission and server registration are active".
- [ ] In that browser, deny notification permission and confirm the status explains it is blocked and the switch is unusable rather than failing silently.
- [ ] On a browser that supports push, force a registration failure and confirm the retry control appears and replaces the registration when used.

**Stop and report if:** the desktop switch cannot be turned on, a desktop notification arrives for a category that is off, the icon badge survives turning the switch off, or the web loses its permission prompt or registration retry.

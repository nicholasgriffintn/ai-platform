---
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-react": minor
"@assistant/desktop": patch
"@assistant/app": patch
---

Let the desktop window turn its own task notifications on.

Task notification settings only knew how a browser delivers. The switch asked for browser permission, waited for a `platform: "web"` push registration against this installation, and disabled every category until one existed. The desktop window has no service worker and never registers, so the switch sat disabled, `preferences.enabled` could never become true, and the local notifications and icon badge the Rust core already knows how to raise stayed silent — even though the window polls Attention for exactly that purpose.

How a device delivers is now a host concern. `ShellHost` carries a `useTaskNotificationChannel` hook: the web passes `useWebPushTaskNotificationChannel`, which keeps the permission, registration and retry behaviour it had, and the desktop passes `useDeviceTaskNotificationChannel`, which only flips the account preference because the running window is the delivery. The categories are shared either way and read the same server preferences through `useTaskNotificationPreferences`.

The desktop icon badge follows the same switch, so turning task notifications off clears it rather than leaving a count behind.

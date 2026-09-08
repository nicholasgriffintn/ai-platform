# Desktop background service keeps a machine online

- **Change:** Install a per-user Polychat background service from the same desktop binary on macOS and Linux, with keychain authentication, the same Tauri single-instance handling and model relay used by the visible app.
- **Surfaces:** Desktop service commands, operating-system service manager, and the machine list.
- **Prerequisites:** A packaged desktop build and a signed-in account on macOS or Linux; access to the account's machine list. Windows is useful for the unsupported-platform check.
- **Risk if wrong:** A service could run without a valid sign-in, duplicate itself, or falsely advertise a machine after the desktop has stopped.
- **Commits:** `cb7df4b69`.

## Verify

- [ ] Run the documented service install command while signed in; confirm the per-user service definition is created and `service status` reports it through the native service manager.
- [ ] Close the desktop window without signing out; within the heartbeat interval confirm the machine remains online in the account's machine list, then stop the service and confirm it becomes offline after the server timeout.
- [ ] Attempt to start a second service instance; confirm it does not start a second application or corrupt the local store.
- [ ] Sign out or remove the session key before installing/running the service; confirm it does not advertise a signed-in machine or accept remote model runs.
- [ ] Run the service command on Windows, if available; confirm it clearly reports that v1 supports macOS and Linux only.
- [ ] Run the uninstall command; confirm the native service definition is removed and the machine stops advertising.

**Stop and report if:** the service runs without an active sign-in, two instances can send heartbeats, the machine stays online after uninstall, or an unsupported platform is treated as supported.

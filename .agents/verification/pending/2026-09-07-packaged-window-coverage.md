# The packaged desktop window is covered on Linux, and the check is on trial

- **Change:** `apps/desktop/tests/e2e/window.spec.mjs` now describes the window the application actually ships — the sign-in gate — instead of the runtime-list prototype ADR 0028 replaced, and the Linux leg of the Desktop build workflow runs it against the built binary under `xvfb`. The step carries `continue-on-error: true`, so it reports without gating until it has proved stable.
- **Surfaces:** desktop; GitHub Actions only.
- **Prerequisites:** none. The step installs `webkit2gtk-driver`, `xvfb` and `tauri-driver` itself.
- **Risk if wrong:** a permanently amber step that everyone learns to ignore, or a gate that fails on WebDriver rather than on the application.
- **Commits:** this change.

## Verify

- [ ] Open a pull request touching `apps/desktop` and confirm the "Test the packaged window" step runs and reports all three cases passing.
- [ ] Confirm the same step passes on at least three further runs before treating it as trustworthy.
- [ ] Remove `continue-on-error: true` from that step in `.github/workflows/desktop-build.yml` and confirm a desktop pull request still goes green.
- [ ] Break the content security policy in `tauri.conf.json` on a scratch branch and confirm the egress case fails, so the check is known to be load-bearing.

**Stop and report if:** the step fails intermittently with driver or display errors rather than assertion failures. Take it back out rather than leaving a random gate in place.

## Not covered

macOS packaged behaviour stays an operator check: `tauri-driver` does not reach it, as ADR 0028 records. Windows is reachable in principle through Microsoft Edge WebDriver, but `msedgedriver` must match the runner's WebView2 runtime, and a drift between them fails the job for reasons unrelated to the application. Add the Windows leg only after the Linux one is trusted.

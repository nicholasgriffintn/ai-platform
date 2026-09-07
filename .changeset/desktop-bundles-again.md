---
"@assistant/desktop": patch
---

Let the desktop application bundle again.

`pnpm tauri build --bundles app` — the command the release workflow runs on every platform — failed on macOS:

```
failed to bundle project Failed to create app icon: `No matching IconType`
```

The bundle icon list held three PNGs and no `.icns`, so the macOS bundler had nothing it could turn into an application icon and left an empty `Polychat.app`. Nothing caught it because the desktop workflow is the only thing that bundles, and a broken bundle is not a broken test.

The icon set now carries `icon.icns` for macOS and `icon.ico` for the Windows installers alongside the PNGs Linux uses, and the configuration names them.

This was also what stopped the `polychat://` scheme from being verifiable: the scheme is declared in configuration but only reaches the operating system through a built bundle. With the bundle building, `CFBundleURLSchemes` carries `polychat` and Launch Services registers the application as its handler.

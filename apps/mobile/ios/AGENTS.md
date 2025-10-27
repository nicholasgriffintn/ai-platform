# iOS Overview
Native Swift-based Polychat client managed via Xcode; integrates with the shared API and mirrors web features where feasible.

## Project Layout
- `Polychat/` – Application source (Swift, SwiftUI/UIKit, assets, entitlements).
- `PolychatTests/`, `PolychatUITests/` – XCTest and UI test targets.
- `Polychat.xcodeproj/` – Xcode project; treat as generated, edited via Xcode only.
- `README.md` – Setup, build, and deployment instructions.

## Commands & Tooling
- **Install JS dependencies** (Capacitor or shared packages)
  ```sh
  pnpm install
  ```
- **Build (CLI)**
  ```sh
  pnpm dev:mobile      # Debug build via xcodebuild (simulator)
  pnpm build:mobile    # Release build
  ```
- **Tests**
  ```sh
  pnpm test:mobile     # Runs xcodebuild test on iPhone 15 simulator
  ```
- **Xcode workflows**
  ```sh
  open apps/mobile/ios/Polychat.xcodeproj
  ```

## Guardrails
- Do not hand-edit `.xcodeproj`, `.xcworkspace`, or provisioning files—use Xcode UI so it maintains integrity.
- Keep secrets out of Info.plist; use environment configuration or secure storage instead.
- When adding capabilities (Push, Siri, etc.), confirm entitlements in Apple Developer account and document expectations.
- Maintain parity with backend feature flags; update API config handling when endpoints change.
- Commit simulator build outputs only when explicitly required (normally excluded).
- Update CI (ios.yml) expectations if the scheme or device destination changes.

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

## Common Modification Locations

### When user requests...

**"Add new Swift feature or screen"**
- **Location**: `Polychat/` directory
- **Pattern**: Follow existing SwiftUI or UIKit patterns
- **API**: Use shared API client for backend calls
- **Testing**: Add tests in `PolychatTests/`

**"Modify API integration"**
- **Configuration**: Update API base URL in configuration files
- **Endpoints**: Align with backend API changes
- **Authentication**: Update token handling if auth flow changes

**"Add new capability"**
- **Xcode**: Add via Xcode UI (Signing & Capabilities tab)
- **Entitlements**: Verify in Apple Developer account
- **Info.plist**: Add required permission descriptions
- **Documentation**: Document new capability requirements

**"Update dependencies"**
- **Swift Package Manager**: Update via Xcode
- **CocoaPods**: Update Podfile if used
- **Capacitor**: Update via pnpm if web bridge used

## Common Pitfalls & Solutions

- **Hand-editing Xcode files**: Always use Xcode UI to modify project settings
- **Hardcoding API URLs**: Use configuration files for environment-specific values
- **Missing permissions**: Add Info.plist descriptions for all capabilities
- **Not testing on device**: Simulator doesn't catch all issues, test on physical devices
- **Ignoring warnings**: Address Xcode warnings before they become errors

## Guardrails
- Do not hand-edit `.xcodeproj`, `.xcworkspace`, or provisioning files—use Xcode UI so it maintains integrity.
- Keep secrets out of Info.plist; use environment configuration or secure storage instead.
- When adding capabilities (Push, Siri, etc.), confirm entitlements in Apple Developer account and document expectations.
- Maintain parity with backend feature flags; update API config handling when endpoints change.
- Commit simulator build outputs only when explicitly required (normally excluded).
- Update CI (ios.yml) expectations if the scheme or device destination changes.
- Follow iOS Human Interface Guidelines for UI/UX consistency
- Test on multiple iOS versions and device sizes

---

## 📋 AGENTS.md Maintenance Protocol

**IMPORTANT**: When you (the AI agent) make changes to the iOS app, you MUST update this AGENTS.md file immediately after completing the implementation.

### Update Triggers
- ✅ Added new Swift feature or screen
- ✅ Modified API integration patterns
- ✅ Added new capabilities or entitlements
- ✅ Changed build configuration
- ✅ Discovered iOS-specific pitfalls

### What to Update
1. **Common Modification Locations**: Add entry for new feature types
2. **Common Pitfalls**: Document iOS-specific problems and solutions
3. **Guardrails**: Add new constraints discovered

### Update Format
```markdown
### [Feature Name] (Added: YYYY-MM-DD)
**Purpose**: [What this feature does]
**Location**: [File paths in Polychat/]
**Requirements**: [iOS version, capabilities, etc.]
```

**Remember**: iOS development has unique constraints - document platform-specific issues.

# iOS Overview
Native Swift-based Polychat client managed via Xcode; integrates with the shared API and mirrors web features where feasible.

## Project Layout
- `Polychat/Models/` – Data models (ChatModels.swift)
- `Polychat/Services/` – Business logic (APIClient, ConversationManager, ModelsStore, AuthenticationManager)
- `Polychat/Views/` – SwiftUI views (ChatView, ConversationListView, SettingsView, ModelSelectorView, etc.)
- `Polychat/DesignSystem/` – Color tokens and reusable design components
- `Polychat/Intents/` – Siri shortcuts integration
- `PolychatTests/`, `PolychatUITests/` – XCTest and UI test targets
- `Polychat.xcodeproj/` – Xcode project; treat as generated, edited via Xcode only

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

## Architecture & Key Patterns

### API Integration
- **APIClient** (`Services/APIClient.swift`) - Singleton HTTP client handling all backend communication
- Base URL: `https://api.polychat.app`
- Authentication: Bearer token via `Authorization` header
- All requests include `platform: "mobile"` identifier
- Chat completions use `store: true` and `completion_id` for persistence

### State Management
- **@MainActor** services ensure UI updates on main thread (ConversationManager, ModelsStore)
- **@Published** properties trigger SwiftUI view updates automatically
- **@EnvironmentObject** for dependency injection across view hierarchy
- Conversations load from API on startup, lazy-load messages on demand

### Data Flow
1. **App Launch** → Load conversations from `/chat/completions`
2. **Select Conversation** → Fetch messages from `/chat/completions/{id}`
3. **Send Message** → POST to `/chat/completions` with `completion_id` to persist
4. **Pull-to-Refresh** → Re-fetch conversation list to sync
5. **Delete** → DELETE `/chat/completions/{id}` then remove locally

### UI Components
- **SwiftUI** declarative views with @State, @Binding for local state
- **Markdown rendering** via AttributedString for message content
- **PhotosPicker** for image selection (multimodal support)
- **Searchable** modifier for conversation search
- **Refreshable** modifier for pull-to-refresh

### Design System
- Color tokens in `DesignSystem/Colors.swift` matching web app palette
- `Color.polychat` namespace for semantic colors (primary, success, warning, error)
- View modifiers: `.polychatPrimaryButton()`, `.polychatCard()`

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

### ⚠️ What to Document

**DO document** (architecture and patterns):
- New architectural patterns (e.g., changing from URLSession to Alamofire)
- New dependency injection approaches
- State management pattern changes
- API integration changes that affect how future features should be built
- Build configuration changes
- New capabilities/entitlements requirements
- iOS-specific pitfalls discovered

**DO NOT document** (implementation details):
- Individual feature additions (those go in git commits)
- UI component additions
- New screens or views
- Bug fixes
- Code refactoring that doesn't change patterns

### When to Update

Only update AGENTS.md when:
1. **Architecture changes** - A future agent needs to know about a new pattern
2. **Common pitfalls** - You discovered an iOS-specific issue that will affect future work
3. **Integration patterns** - How services communicate changed fundamentally
4. **Build/deployment** - Commands or requirements changed

### How to Update

- **Replace** existing sections with updated patterns, don't add dated entries
- Keep it **concise** - 1-2 paragraphs max per section
- Focus on **"how it works"** not **"what changed when"**
- Update the relevant architecture section, not a changelog

**Example BAD update:**
```markdown
### New Button Added (2025-11-05)
Added a blue button to the settings screen at line 42...
```

**Example GOOD update:**
```markdown
### State Management
- Use @MainActor for services that update UI
- ConversationManager now uses lazy loading pattern for performance
```

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

## Recent Feature Additions (Added: 2025-11-05)

### Enhanced Conversation List with Search & Categorization
**Location**: `Polychat/Views/ConversationListView.swift`
**Features**:
- Search functionality across conversation titles and message content
- Date-based categorization (Today, Yesterday, This Week, This Month, Older)
- Improved conversation row design with icons, message count, and relative timestamps
- Empty search state with helpful messaging
- Better visual hierarchy and spacing

### Markdown Support in Chat Messages
**Location**: `Polychat/Views/ChatView.swift` (MessageBubble, MarkdownText)
**Features**:
- Native markdown rendering using AttributedString
- Text selection enabled for all messages
- Special styling for error messages and loading states
- Message actions (copy, regenerate) appear on tap
- Improved message bubble design with better spacing

### Advanced Chat Settings Panel
**Location**: `Polychat/Views/ChatSettingsView.swift`, `Polychat/Models/ChatModels.swift`
**Features**:
- Temperature control (0-2 with 0.1 step)
- Top P control (0-1 with 0.05 step)
- Optional max tokens limit (256-8192 with 256 step)
- Response mode selection (normal, concise, explanatory, formal)
- Reset to defaults option
- Accessible via menu in chat toolbar

### Artifacts Panel for Code & Media
**Location**: `Polychat/Views/ArtifactsView.swift`, `Polychat/Models/ChatModels.swift`
**Features**:
- Automatic extraction of code blocks from messages using regex
- Support for multiple artifact types (code, image, text, markdown)
- Full-screen artifact viewer with syntax highlighting
- Copy functionality for artifacts
- Badge indicator in toolbar showing artifact count
- Expandable artifact cards with preview

### Multimodal Support (Image Uploads)
**Location**: `Polychat/Views/ImagePickerView.swift`, `Polychat/Views/ChatView.swift`
**Features**:
- PhotosPicker integration for selecting up to 5 images
- Image preview thumbnails with remove buttons
- Horizontal scrolling image gallery
- Integrated into message input with visual feedback
- Send button enables when images are selected

### Enhanced Model Selector
**Location**: `Polychat/Views/ModelSelectorView.swift`
**Features**:
- Model count badges per provider in section headers
- Model description display in rows
- Improved capability badges (Functions, Vision, Context)
- Better visual hierarchy and spacing
- Empty search state
- Refresh capability with pull-to-refresh

### Design System & Color Tokens
**Location**: `Polychat/DesignSystem/Colors.swift`
**Features**:
- Polychat color palette matching web app (zinc scales, primary blue)
- Semantic color definitions (success, warning, error)
- View modifiers for consistent button and card styling
- Dark mode compatible color system

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

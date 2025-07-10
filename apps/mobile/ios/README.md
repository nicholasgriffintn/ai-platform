# Polychat iOS App

Native iOS client for the Polychat AI platform.

## Development Setup

1. Install Xcode 15+
2. Clone the repository
3. Install dependencies:
   ```sh
   pnpm install
   ```
4. Open the project in Xcode:
   ```sh
   open apps/mobile/ios/Polychat.xcodeproj
   ```

## Running the App

- Development build:
  ```sh
  pnpm dev:mobile
  ```

- Production build:
  ```sh
  pnpm build:mobile
  ```

- Running tests:
  ```sh
  pnpm test:mobile
  ```

## Features

- Chat with AI assistant
- Conversation history
- Siri integration via App Intents
- Authentication

## Deployment

The app is automatically built and archived on pushes to main branch via GitHub Actions.

For manual deployment:

1. Update version in Info.plist
2. Create a release build:
   ```sh
   pnpm build:mobile
   ```
3. Archive and export IPA using Xcode

## Siri Integration

To test Siri shortcuts during development:

1. Add the following entitlement to your developer account:
   ```
   com.apple.developer.siri
   ```
2. Enable Siri capability in Xcode
3. Test shortcuts in Xcode's Shortcuts app simulator

## Code Signing

For production deployment, you'll need to:

1. Create an App ID in Apple Developer Portal
2. Generate distribution certificates
3. Create provisioning profiles
4. Configure in Xcode project settings

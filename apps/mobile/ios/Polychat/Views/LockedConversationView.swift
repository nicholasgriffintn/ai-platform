import SwiftUI

struct LockedConversationView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 32))
                .foregroundStyle(.primary)

            Text("This chat is locked")
                .font(.headline)
                .foregroundStyle(.primary)

            Text("Open it on the web to unlock it with your passkey or password. Polychat cannot read a locked chat.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.polychat.background)
    }
}

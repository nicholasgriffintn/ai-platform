import SwiftUI

struct PolychatCardModifier: ViewModifier {
    var padding: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.polychat.border, lineWidth: 1)
            )
    }
}

extension View {
    func polychatCard(padding: CGFloat = 16) -> some View {
        modifier(PolychatCardModifier(padding: padding))
    }
}

struct EyebrowLabel: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(Color.polychat.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct StatusPill: View {
    let label: String
    let tint: Color
    var systemImage: String?

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            Text(label)
        }
        .font(.caption2.weight(.semibold))
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(tint.opacity(0.12), in: Capsule())
    }
}

struct FaviconView: View {
    let url: String?
    let fallbackSystemImage: String
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.polychat.selection)
            AsyncImage(url: url.flatMap(URLDisplay.faviconURL)) { phase in
                if let image = phase.image {
                    image
                        .resizable()
                        .scaledToFit()
                        .padding(size * 0.2)
                } else {
                    Image(systemName: fallbackSystemImage)
                        .font(.subheadline)
                        .foregroundStyle(Color.polychat.primary)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct InlineErrorBanner: View {
    let message: String
    var onRetry: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.polychat.attention)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Color.polychat.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let onRetry {
                Button("Retry", action: onRetry)
                    .font(.footnote.weight(.semibold))
            }
        }
        .padding(12)
        .background(Color.polychat.attention.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

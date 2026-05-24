import SwiftUI

struct ToolUsePartView: View {
    let part: ChatMessagePart

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tool call: \(part.name ?? "tool")")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.orange)
            ScrollView(.horizontal) {
                Text(part.input?.prettyString ?? "{}")
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
            }
        }
        .padding(12)
        .background(Color.orange.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.orange.opacity(0.25), lineWidth: 1))
    }
}

struct ToolResultPartView: View {
    let part: ChatMessagePart

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tool result\(part.name.map { ": \($0)" } ?? "")\(part.status.map { " (\($0))" } ?? "")")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.polychat.primary)

            if let content = part.content?.prettyString, !content.isEmpty {
                MarkdownText(content: content, isUser: false)
            } else {
                Text("No tool output")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color.polychat.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.primary.opacity(0.25), lineWidth: 1))
    }
}

struct SnapshotPartView: View {
    let title: String?
    let summary: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            MarkdownText(content: summary, isUser: false)
        }
        .padding(12)
        .background(Color.polychat.elevatedBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

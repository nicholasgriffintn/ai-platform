import SwiftUI

struct MessageBubble: View {
    let message: ChatMessage
    let activityLabel: String?
    let onRetry: () -> Void
    let onEdit: (String) -> Void
    @State private var isEditing = false
    @State private var editedText = ""

    var body: some View {
        switch message.role {
        case "user":
            userBubble
        case "tool":
            if let request = message.approvalRequest {
                ToolApprovalCard(request: request, isPending: message.status == "pending")
            } else {
                ToolActivityRow(message: message)
            }
        case "assistant":
            assistantBody
        default:
            EmptyView()
        }
    }

    private var userBubble: some View {
        HStack {
            Spacer(minLength: 48)
            MessageContentView(message: message)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.polychat.messageUserBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .contextMenu {
                    copyButton
                    Button {
                        editedText = message.textContent
                        isEditing = true
                    } label: {
                        Label("Edit and resend", systemImage: "pencil")
                    }
                }
        }
        .alert("Edit message", isPresented: $isEditing) {
            TextField("Message", text: $editedText, axis: .vertical)
            Button("Cancel", role: .cancel) {}
            Button("Resend") { onEdit(editedText) }
                .disabled(editedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        } message: {
            Text("Polychat reruns the conversation from here and replaces the later replies.")
        }
    }

    @ViewBuilder
    private var assistantBody: some View {
        if message.status == "failed" || message.textContent.hasPrefix("Error:") {
            InlineErrorBanner(
                message: message.textContent.hasPrefix("Error:")
                    ? String(message.textContent.dropFirst(6)).trimmingCharacters(in: .whitespaces)
                    : message.data?.error ?? "This reply did not finish.",
                onRetry: onRetry
            )
        } else if message.isAwaitingFirstToken {
            ThinkingIndicator(label: activityLabel ?? "Thinking")
        } else if message.hasVisibleAssistantContent {
            MessageContentView(message: message)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contextMenu {
                    copyButton
                    Button(action: onRetry) {
                        Label("Retry", systemImage: "arrow.clockwise")
                    }
                }
        }
    }

    private var copyButton: some View {
        Button {
            UIPasteboard.general.string = message.renderedTextContent
        } label: {
            Label("Copy", systemImage: "doc.on.doc")
        }
    }
}

struct ThinkingIndicator: View {
    let label: String
    @State private var phase = false

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.polychat.textMuted)
                        .frame(width: 6, height: 6)
                        .opacity(phase ? 1 : 0.3)
                        .animation(
                            .easeInOut(duration: 0.6).repeatForever().delay(Double(index) * 0.2),
                            value: phase
                        )
                }
            }
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.polychat.textMuted)
                .contentTransition(.opacity)
        }
        .padding(.vertical, 6)
        .onAppear { phase = true }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }
}

struct ToolActivityRow: View {
    private static let outputPreviewLimit = 6_000

    let message: ChatMessage
    @State private var isExpanded = false

    private var toolPart: ChatMessagePart? {
        message.parts?.first { $0.type == "tool_result" || $0.type == "tool_use" }
    }

    private var isRunning: Bool {
        toolPart?.type == "tool_use"
    }

    private var failed: Bool {
        let status = (toolPart?.status ?? message.status ?? "").lowercased()
        return status == "error" || status == "failed" || status == "failure"
    }

    private var toolName: String {
        (toolPart?.name ?? message.name ?? "tool")
            .replacingOccurrences(of: "_", with: " ")
    }

    private var output: String? {
        let text = toolPart?.content?.prettyString ?? message.textContent
        return text.isEmpty ? nil : text
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Group {
                        if isRunning {
                            ProgressView().controlSize(.mini)
                        } else {
                            Image(systemName: failed ? "exclamationmark.circle" : "checkmark.circle")
                                .foregroundStyle(failed ? Color.polychat.error : Color.polychat.success)
                        }
                    }
                    .frame(width: 16)
                    Text(isRunning ? "Using \(toolName)" : failed ? "\(toolName.capitalized) failed" : "Used \(toolName)")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Color.polychat.textMuted)
                    Spacer(minLength: 0)
                    if output != nil {
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.polychat.textMuted)
                            .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(output == nil)

            if isExpanded, let output {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(output.count > Self.outputPreviewLimit
                         ? "\(output.prefix(Self.outputPreviewLimit))\n…"
                         : output)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(Color.polychat.text)
                        .textSelection(.enabled)
                        .padding(10)
                }
                .frame(maxHeight: 320)
                .background(Color.polychat.surfaceElevated, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

extension ChatMessage {
    var isAwaitingFirstToken: Bool {
        role == "assistant" && status == "in_progress" && textContent.isEmpty && reasoning == nil && parts?.isEmpty != false
    }

    var hasVisibleAssistantContent: Bool {
        if !textContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || reasoning != nil {
            return true
        }

        if data?.attachments?.isEmpty == false || data?.asyncInvocation != nil {
            return true
        }

        return parts?.contains { $0.type != "tool_use" } == true
    }

    var renderedTextContent: String {
        if let parts, !parts.isEmpty {
            let partText = parts.compactMap { part -> String? in
                part.type == "text" ? part.text : nil
            }.joined(separator: "\n\n")
            if !partText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return partText
            }
        }

        return textContent
    }
}

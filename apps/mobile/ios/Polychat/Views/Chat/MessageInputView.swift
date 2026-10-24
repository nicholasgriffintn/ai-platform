import SwiftUI

struct MessageInputView: View {
    @Binding var messageText: String
    @Binding var selectedAttachments: [ComposerAttachment]
    let inputFocus: FocusState<Bool>.Binding
    let isUploadingAttachments: Bool
    let isRecordingVoice: Bool
    let isTranscribingVoice: Bool
    let notice: String?
    let activeModelName: String
    let activeModelProvider: String?
    let isRunActive: Bool
    let isCancellationPending: Bool
    let onFilesPicked: ([PickedComposerFile]) -> Void
    let onVoiceTapped: () -> Void
    let onModelTapped: () -> Void
    let onStopRun: () -> Void
    let sendMessage: () -> Void

    private var hasContent: Bool {
        !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !selectedAttachments.isEmpty
    }

    private var canSend: Bool {
        hasContent && !isUploadingAttachments && !isRunActive
    }

    var body: some View {
        VStack(spacing: 8) {
            if let notice {
                Text(notice)
                    .font(.caption)
                    .foregroundStyle(Color.polychat.error)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
            }

            VStack(alignment: .leading, spacing: 8) {
                if !selectedAttachments.isEmpty || isUploadingAttachments {
                    SelectedAttachmentsView(
                        attachments: selectedAttachments,
                        isUploading: isUploadingAttachments
                    ) { attachmentId in
                        selectedAttachments.removeAll { $0.id == attachmentId }
                    }
                }

                TextField(isRecordingVoice ? "Listening…" : "Message Polychat", text: $messageText, axis: .vertical)
                    .focused(inputFocus)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .lineLimit(1...6)
                    .padding(.horizontal, 4)
                    .padding(.top, 4)

                HStack(spacing: 6) {
                    AttachmentPickerView(disabled: isUploadingAttachments, onFilesPicked: onFilesPicked)
                        .foregroundStyle(Color.polychat.textMuted)
                        .frame(width: 32, height: 32)

                    Button(action: onModelTapped) {
                        HStack(spacing: 5) {
                            ModelIconView(modelName: activeModelName, provider: activeModelProvider, size: 16)
                            Text(activeModelName)
                                .font(.footnote.weight(.medium))
                                .lineLimit(1)
                            Image(systemName: "chevron.down")
                                .font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(Color.polychat.text)
                        .padding(.horizontal, 10)
                        .frame(height: 30)
                        .background(Color.polychat.surfaceElevated, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(isRunActive)
                    .accessibilityLabel("Model: \(activeModelName)")

                    Spacer(minLength: 4)

                    Button(action: onVoiceTapped) {
                        Image(systemName: isRecordingVoice ? "stop.fill" : isTranscribingVoice ? "waveform" : "mic")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(isRecordingVoice ? Color.white : Color.polychat.textMuted)
                            .frame(width: 32, height: 32)
                            .background(isRecordingVoice ? Color.polychat.error : Color.clear, in: Circle())
                    }
                    .disabled(isTranscribingVoice)
                    .accessibilityLabel(isRecordingVoice ? "Stop dictation" : "Dictate")

                    if isRunActive && !hasContent {
                        Button(action: onStopRun) {
                            Image(systemName: isCancellationPending ? "hourglass" : "stop.fill")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Color.polychat.primaryForeground)
                                .frame(width: 32, height: 32)
                                .background(Color.polychat.text, in: Circle())
                        }
                        .disabled(isCancellationPending)
                        .accessibilityLabel(isCancellationPending ? "Stop requested" : "Stop")
                    } else {
                        Button(action: sendMessage) {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(Color.polychat.primaryForeground)
                                .frame(width: 32, height: 32)
                                .background(canSend ? Color.polychat.primary : Color.polychat.borderStrong.opacity(0.5), in: Circle())
                        }
                        .disabled(!canSend)
                        .accessibilityLabel("Send")
                    }
                }
            }
            .padding(10)
            .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(inputFocus.wrappedValue ? Color.polychat.borderStrong : Color.polychat.border, lineWidth: 1)
            )
        }
        .padding(.horizontal, 12)
        .padding(.top, 6)
        .padding(.bottom, 8)
        .frame(maxWidth: 760)
        .frame(maxWidth: .infinity)
        .background(Color.polychat.background)
    }
}

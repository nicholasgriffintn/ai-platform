import SwiftUI
struct MessageInputView: View {
    @Binding var messageText: String
    @Binding var selectedAttachments: [ComposerAttachment]
    let inputFocus: FocusState<Bool>.Binding
    let isUploadingAttachments: Bool
    let isRecordingVoice: Bool
    let isTranscribingVoice: Bool
    let uploadError: String?
    let voiceError: String?
    let activeModelName: String
    let activeModelProvider: String?
    let onFilesPicked: ([PickedComposerFile]) -> Void
    let onVoiceTapped: () -> Void
    let onModelTapped: () -> Void
    let onSettingsTapped: () -> Void
    let sendMessage: () -> Void

    private var canSend: Bool {
        (!messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !selectedAttachments.isEmpty) && !isUploadingAttachments
    }

    var body: some View {
        VStack(spacing: 0) {
            if !selectedAttachments.isEmpty || isUploadingAttachments {
                SelectedAttachmentsView(
                    attachments: selectedAttachments,
                    isUploading: isUploadingAttachments
                ) { attachmentId in
                    selectedAttachments.removeAll { $0.id == attachmentId }
                }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if let inputError = uploadError ?? voiceError {
                Text(inputError)
                    .font(.caption)
                    .foregroundStyle(Color.polychat.error)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }

            VStack(spacing: 0) {
                TextField("Ask me anything...", text: $messageText, axis: .vertical)
                    .focused(inputFocus)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .lineLimit(1...4)
                    .frame(minHeight: 30, alignment: .topLeading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .onSubmit {
                        if canSend {
                            sendMessage()
                        }
                    }

                Rectangle()
                    .fill(Color.polychat.border)
                    .frame(height: 1)

                HStack(spacing: 10) {
                    AttachmentPickerView(disabled: isUploadingAttachments, onFilesPicked: onFilesPicked)
                        .foregroundColor(.secondary)

                    Button(action: onModelTapped) {
                        HStack(spacing: 6) {
                            ModelIconView(
                                modelName: activeModelName,
                                provider: activeModelProvider,
                                size: 18
                            )

                            Text(activeModelName)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(maxWidth: 150, alignment: .leading)
                            Image(systemName: "chevron.down")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundColor(.primary)
                        .padding(.horizontal, 10)
                        .frame(height: 34)
                        .background(Color.polychat.elevatedBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Select model")

                    Button(action: onSettingsTapped) {
                        Image(systemName: "slider.horizontal.3")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.secondary)
                            .frame(width: 34, height: 34)
                    }
                    .accessibilityLabel("Chat settings")

                    Spacer(minLength: 4)

                    Button(action: onVoiceTapped) {
                        Image(systemName: voiceButtonIcon)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(isRecordingVoice ? .white : .secondary)
                            .frame(width: 34, height: 34)
                            .background(isRecordingVoice ? Color.red : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .disabled(isTranscribingVoice)

                    Button(action: sendMessage) {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(Color(light: .white, dark: .black))
                            .frame(width: 38, height: 38)
                            .background(canSend ? Color(light: .black, dark: Color.polychat.offWhite) : Color.polychat.zinc500.opacity(0.55))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .disabled(!canSend)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
            }
            .background(Color.polychat.composerBackground)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(inputFocus.wrappedValue ? Color.polychat.zinc500 : Color.polychat.border, lineWidth: 1)
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: 900)
        }
        .frame(maxWidth: .infinity)
        .background(Color.polychat.background)
    }

    private var voiceButtonIcon: String {
        if isRecordingVoice {
            return "stop.fill"
        }
        if isTranscribingVoice {
            return "waveform"
        }
        return "mic"
    }
}

import Foundation

@MainActor
final class ChatComposerController: ObservableObject {
    @Published private(set) var isUploading = false
    @Published private(set) var isRecording = false
    @Published private(set) var isTranscribing = false
    @Published var error: String?

    private let voiceRecorder = VoiceRecorder()

    func upload(_ files: [PickedComposerFile], apiClient: APIClient) async -> [ComposerAttachment] {
        guard !files.isEmpty else { return [] }

        isUploading = true
        error = nil
        defer { isUploading = false }

        var uploaded: [ComposerAttachment] = []
        do {
            for file in files {
                let response = try await apiClient.uploadFile(
                    data: file.data,
                    fileName: file.fileName,
                    mimeType: file.mimeType,
                    fileType: file.fileType,
                    convertToMarkdown: file.convertToMarkdown
                )
                uploaded.append(
                    ComposerAttachment(
                        type: Self.attachmentType(from: response, fallbackFileType: file.fileType),
                        url: response.url,
                        name: response.name,
                        markdown: response.markdown,
                        thumbnail: file.thumbnail
                    )
                )
            }
        } catch {
            self.error = error.localizedDescription
        }

        return uploaded
    }

    func toggleDictation(apiClient: APIClient) async -> String? {
        if voiceRecorder.isRecording {
            isRecording = false
            do {
                let url = try voiceRecorder.stop()
                return await transcribe(url, apiClient: apiClient)
            } catch {
                self.error = error.localizedDescription
                return nil
            }
        }

        error = nil
        do {
            try await voiceRecorder.start()
            isRecording = true
        } catch {
            self.error = error.localizedDescription
        }
        return nil
    }

    private func transcribe(_ url: URL, apiClient: APIClient) async -> String? {
        isTranscribing = true
        defer {
            isTranscribing = false
            try? FileManager.default.removeItem(at: url)
        }

        do {
            let data = try Data(contentsOf: url)
            let response = try await apiClient.transcribeAudio(
                data: data,
                fileName: url.lastPathComponent,
                mimeType: "audio/mp4"
            )
            return response.response.content
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    static func message(text: String, attachments: [ComposerAttachment]) -> ChatMessage {
        guard !attachments.isEmpty else {
            return ChatMessage(role: "user", content: text)
        }

        var blocks: [MessageContentBlock] = []
        if !text.isEmpty {
            blocks.append(.text(MessageContentBlock.TextBlock(text: text)))
        }
        for attachment in attachments where attachment.type != .markdownDocument || attachment.markdown?.isEmpty == false {
            blocks.append(attachment.contentBlock())
        }
        return ChatMessage(role: "user", contentBlocks: blocks)
    }

    private static func attachmentType(from response: UploadResponse, fallbackFileType: String) -> ComposerAttachmentType {
        if response.type == "markdown_document" {
            return .markdownDocument
        }

        switch fallbackFileType {
        case "image": return .image
        case "audio": return .audio
        default: return .document
        }
    }
}

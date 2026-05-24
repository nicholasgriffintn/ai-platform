import SwiftUI

enum ComposerAttachmentType: String {
    case image
    case document
    case audio
    case markdownDocument

    var iconName: String {
        switch self {
        case .image:
            return "photo"
        case .document:
            return "doc.text"
        case .audio:
            return "waveform"
        case .markdownDocument:
            return "text.page"
        }
    }
}

struct ComposerAttachment: Identifiable, Equatable {
    let id = UUID()
    let type: ComposerAttachmentType
    let url: String
    let name: String
    let markdown: String?
    let thumbnail: UIImage?

    func contentBlock() -> MessageContentBlock {
        switch type {
        case .image:
            return .imageUrl(MessageContentBlock.ImageUrlBlock(url: url, detail: "auto"))
        case .document:
            return .documentUrl(MessageContentBlock.DocumentUrlBlock(url: url, name: name))
        case .audio:
            let format = name.lowercased().hasSuffix(".wav") ? "wav" : "mp3"
            return .inputAudio(MessageContentBlock.InputAudioBlock(data: url, format: format))
        case .markdownDocument:
            return .markdownDocument(
                MessageContentBlock.MarkdownDocumentBlock(markdown: markdown ?? "", name: name)
            )
        }
    }
}

import SwiftUI

struct InlineArtifactCalloutView: View {
    let artifact: Artifact
    @State private var showingArtifact = false

    private var isCode: Bool {
        let language = artifact.language?.lowercased() ?? ""
        return ["jsx", "javascript", "html", "svg"].contains { language.contains($0) }
    }

    var body: some View {
        Button {
            showingArtifact = true
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: isCode ? "chevron.left.forwardslash.chevron.right" : "doc.text")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 3) {
                    Text(artifact.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text("Click here to open the \(isCode ? "code" : "file")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 8)

                if let language = artifact.language {
                    Text(language)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(10)
            .background(Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.polychat.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showingArtifact) {
            FullArtifactView(artifact: artifact)
        }
    }
}

struct MessageDataAttachmentsView: View {
    let data: ChatMessageData

    var body: some View {
        if let attachments = data.attachments, !attachments.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(attachments) { attachment in
                    switch attachment.type {
                    case "image":
                        RemoteImageView(urlString: attachment.url)
                    case "audio":
                        AudioAttachmentView(urlString: attachment.url, name: attachment.name)
                    case "document":
                        DocumentAttachmentView(urlString: attachment.url, name: attachment.name, isMarkdown: attachment.isMarkdown == true)
                    default:
                        if !attachment.url.isEmpty {
                            Text("[[CONTENT:\(attachment.url)]]")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

struct RemoteImageView: View {
    let urlString: String

    var body: some View {
        if let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                case .failure:
                    DocumentAttachmentView(urlString: urlString, name: "Image", isMarkdown: false)
                case .empty:
                    ProgressView()
                        .frame(height: 120)
                        .frame(maxWidth: .infinity)
                @unknown default:
                    EmptyView()
                }
            }
        }
    }
}

struct DocumentAttachmentView: View {
    let urlString: String
    let name: String?
    let isMarkdown: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "doc")
                .foregroundStyle(Color.polychat.primary)

            VStack(alignment: .leading, spacing: 3) {
                Text(name ?? "Document")
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                if isMarkdown {
                    Text("converted to text")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let url = URL(string: urlString), !urlString.isEmpty {
                    Link("View document", destination: url)
                        .font(.caption)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Color.polychat.elevatedBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

struct AudioAttachmentView: View {
    let urlString: String
    let name: String?

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "speaker.wave.2")
                .foregroundStyle(Color.purple)
            VStack(alignment: .leading, spacing: 3) {
                Text(name ?? "Audio")
                    .font(.subheadline)
                if let url = URL(string: urlString), !urlString.isEmpty {
                    Link("Open audio", destination: url)
                        .font(.caption)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Color.polychat.elevatedBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

struct FilePartView: View {
    let name: String?
    let url: String?
    let mimeType: String?

    var body: some View {
        if let mimeType, mimeType.hasPrefix("image/"), let url {
            RemoteImageView(urlString: url)
        } else if let mimeType, mimeType.hasPrefix("audio/") {
            AudioAttachmentView(urlString: url ?? "", name: name)
        } else {
            DocumentAttachmentView(urlString: url ?? "", name: name, isMarkdown: mimeType == "text/markdown")
        }
    }
}

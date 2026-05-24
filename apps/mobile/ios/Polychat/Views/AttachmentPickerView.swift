import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct PickedComposerFile: Identifiable {
    let id = UUID()
    let data: Data
    let fileName: String
    let mimeType: String
    let fileType: String
    let convertToMarkdown: Bool
    let thumbnail: UIImage?
}

struct AttachmentPickerView: View {
    let disabled: Bool
    let onFilesPicked: ([PickedComposerFile]) -> Void

    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var showingDocumentPicker = false

    var body: some View {
        Menu {
            PhotosPicker(selection: $selectedItems, maxSelectionCount: 5, matching: .images) {
                Label("Photo Library", systemImage: "photo")
            }

            Button {
                showingDocumentPicker = true
            } label: {
                Label("Files", systemImage: "doc")
            }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 18, weight: .semibold))
                .frame(width: 32, height: 32)
        }
        .disabled(disabled)
        .sheet(isPresented: $showingDocumentPicker) {
            DocumentPicker { files in
                onFilesPicked(files)
            }
        }
        .onChange(of: selectedItems) {
            loadSelectedImages()
        }
    }

    private func loadSelectedImages() {
        Task {
            var files: [PickedComposerFile] = []

            for item in selectedItems {
                guard let data = try? await item.loadTransferable(type: Data.self) else {
                    continue
                }

                let image = UIImage(data: data)
                let uploadData = image?.jpegData(compressionQuality: 0.88) ?? data
                files.append(
                    PickedComposerFile(
                        data: uploadData,
                        fileName: "image-\(UUID().uuidString).jpg",
                        mimeType: "image/jpeg",
                        fileType: "image",
                        convertToMarkdown: false,
                        thumbnail: image
                    )
                )
            }

            await MainActor.run {
                selectedItems = []
                if !files.isEmpty {
                    onFilesPicked(files)
                }
            }
        }
    }
}

private struct DocumentPicker: UIViewControllerRepresentable {
    let onFilesPicked: ([PickedComposerFile]) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let controller = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        controller.allowsMultipleSelection = true
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onFilesPicked: onFilesPicked)
    }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onFilesPicked: ([PickedComposerFile]) -> Void

        init(onFilesPicked: @escaping ([PickedComposerFile]) -> Void) {
            self.onFilesPicked = onFilesPicked
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            let files = urls.compactMap { url -> PickedComposerFile? in
                let didStartAccessing = url.startAccessingSecurityScopedResource()
                defer {
                    if didStartAccessing {
                        url.stopAccessingSecurityScopedResource()
                    }
                }

                guard let data = try? Data(contentsOf: url) else {
                    return nil
                }

                let resourceValues = try? url.resourceValues(forKeys: [.contentTypeKey, .nameKey])
                let fileName = resourceValues?.name ?? url.lastPathComponent
                let contentType = resourceValues?.contentType ?? UTType(filenameExtension: url.pathExtension)
                let mimeType = contentType?.preferredMIMEType ?? "application/octet-stream"
                let fileType = inferUploadType(mimeType: mimeType, fileName: fileName, contentType: contentType)

                return PickedComposerFile(
                    data: data,
                    fileName: fileName,
                    mimeType: mimeType,
                    fileType: fileType,
                    convertToMarkdown: shouldConvertToMarkdown(fileType: fileType, mimeType: mimeType),
                    thumbnail: nil
                )
            }

            if !files.isEmpty {
                onFilesPicked(files)
            }
        }

        private func inferUploadType(mimeType: String, fileName: String, contentType: UTType?) -> String {
            if mimeType.hasPrefix("image/") {
                return "image"
            }
            if mimeType.hasPrefix("audio/") {
                return "audio"
            }
            if isCodeLikeFile(fileName: fileName, mimeType: mimeType, contentType: contentType) {
                return "code"
            }
            return "document"
        }

        private func shouldConvertToMarkdown(fileType: String, mimeType: String) -> Bool {
            fileType == "document" && mimeType != "application/pdf"
        }

        private func isCodeLikeFile(fileName: String, mimeType: String, contentType: UTType?) -> Bool {
            let codeExtensions: Set<String> = [
                "ts", "tsx", "js", "jsx", "json", "py", "go", "java", "rb", "php", "rs",
                "cs", "kt", "swift", "scala", "sh", "yml", "yaml", "sql", "toml", "c",
                "cc", "cpp", "cxx", "hpp", "h"
            ]
            let ext = URL(fileURLWithPath: fileName).pathExtension.lowercased()
            return mimeType.hasPrefix("text/") || codeExtensions.contains(ext) || contentType?.conforms(to: .sourceCode) == true
        }
    }
}

struct SelectedAttachmentsView: View {
    let attachments: [ComposerAttachment]
    let isUploading: Bool
    let onRemove: (ComposerAttachment.ID) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachments) { attachment in
                    AttachmentChip(attachment: attachment) {
                        onRemove(attachment.id)
                    }
                }

                if isUploading {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Uploading")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }
}

private struct AttachmentChip: View {
    let attachment: ComposerAttachment
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            if let thumbnail = attachment.thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 34, height: 34)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            } else {
                Image(systemName: attachment.type.iconName)
                    .foregroundStyle(Color.polychat.primary)
            }

            Text(attachment.name)
                .font(.caption)
                .lineLimit(1)
                .frame(maxWidth: 140, alignment: .leading)

            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

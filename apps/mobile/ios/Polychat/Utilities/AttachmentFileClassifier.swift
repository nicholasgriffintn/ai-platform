import Foundation
import UniformTypeIdentifiers

enum AttachmentFileClassifier {
    private static let codeExtensions: Set<String> = [
        "ts", "tsx", "js", "jsx", "json", "py", "go", "java", "rb", "php", "rs",
        "cs", "kt", "swift", "scala", "sh", "yml", "yaml", "sql", "toml", "c",
        "cc", "cpp", "cxx", "hpp", "h"
    ]

    static func inferUploadType(mimeType: String, fileName: String, contentType: UTType?) -> String {
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

    static func shouldConvertToMarkdown(fileType: String, mimeType: String) -> Bool {
        fileType == "document" && mimeType != "application/pdf"
    }

    private static func isCodeLikeFile(fileName: String, mimeType: String, contentType: UTType?) -> Bool {
        let fileExtension = URL(fileURLWithPath: fileName).pathExtension.lowercased()
        return mimeType.hasPrefix("text/") ||
            codeExtensions.contains(fileExtension) ||
            contentType?.conforms(to: .sourceCode) == true
    }
}

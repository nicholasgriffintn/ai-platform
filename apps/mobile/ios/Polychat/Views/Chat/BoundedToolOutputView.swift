import SwiftUI

struct BoundedToolOutputView: View {
    static let previewCharacterLimit = 40 * 1024

    let content: String
    @State private var showFull = false

    private var isBounded: Bool {
        content.count > Self.previewCharacterLimit
    }

    private var visibleContent: String {
        guard isBounded, !showFull else {
            return content
        }

        return String(content.prefix(Self.previewCharacterLimit))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            MarkdownText(content: visibleContent, isUser: false)

            if isBounded {
                Button(showFull ? "Show output preview" : "Show full output (\(content.count) characters)") {
                    showFull.toggle()
                }
                .font(.caption.weight(.semibold))
            }
        }
    }
}

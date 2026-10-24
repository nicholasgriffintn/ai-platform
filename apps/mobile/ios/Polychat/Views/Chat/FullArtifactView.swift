import SwiftUI

struct FullArtifactView: View {
    let artifact: Artifact
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                if artifact.type == .code {
                    Text(artifact.content)
                        .font(.system(.body, design: .monospaced))
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                } else {
                    Text(artifact.content)
                        .font(.body)
                        .padding()
                        .textSelection(.enabled)
                }
            }
            .navigationTitle(artifact.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        UIPasteboard.general.string = artifact.content
                    }) {
                        Image(systemName: "doc.on.doc")
                    }
                }
            }
        }
    }
}

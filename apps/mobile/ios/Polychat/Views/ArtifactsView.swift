import SwiftUI

struct ArtifactsView: View {
    let artifacts: [Artifact]
    @Environment(\.dismiss) private var dismiss
    @State private var selectedArtifact: Artifact?

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                if artifacts.isEmpty {
                    emptyState
                } else {
                    artifactsList
                }
            }
            .navigationTitle("Artifacts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text")
                .font(.system(size: 60))
                .foregroundColor(.gray)
            Text("No Artifacts")
                .font(.headline)
                .foregroundColor(.primary)
            Text("Code blocks and media will appear here")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var artifactsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(artifacts) { artifact in
                    ArtifactCard(artifact: artifact)
                }
            }
            .padding()
        }
    }
}

struct ArtifactCard: View {
    let artifact: Artifact
    @State private var showingFullView = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: iconForType(artifact.type))
                    .foregroundColor(.blue)
                Text(artifact.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()
                if artifact.type == .code {
                    if let language = artifact.language {
                        Text(language)
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.1))
                            .foregroundColor(.blue)
                            .cornerRadius(4)
                    }
                }
            }

            if artifact.type == .code {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(artifact.content)
                        .font(.system(.caption, design: .monospaced))
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Color(.systemGray6))
                .cornerRadius(8)
                .frame(maxHeight: 150)
            } else {
                Text(artifact.content)
                    .font(.body)
                    .lineLimit(3)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 12) {
                Button(action: {
                    showingFullView = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                        Text("View Full")
                    }
                    .font(.caption)
                    .foregroundColor(.blue)
                }

                Button(action: {
                    UIPasteboard.general.string = artifact.content
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "doc.on.doc")
                        Text("Copy")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
        .sheet(isPresented: $showingFullView) {
            FullArtifactView(artifact: artifact)
        }
    }

    private func iconForType(_ type: Artifact.ArtifactType) -> String {
        switch type {
        case .code:
            return "curlybraces"
        case .image:
            return "photo"
        case .text:
            return "doc.text"
        case .markdown:
            return "doc.richtext"
        }
    }
}

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

#Preview {
    ArtifactsView(artifacts: [
        Artifact(id: "1", type: .code, title: "Swift Code", content: "func hello() {\n    print(\"Hello, world!\")\n}", language: "swift"),
        Artifact(id: "2", type: .code, title: "Python Code", content: "def hello():\n    print('Hello, world!')", language: "python")
    ])
}

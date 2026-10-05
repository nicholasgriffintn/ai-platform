import SwiftUI

struct ProjectFlowHistoryView: View {
    let flow: ProjectFlow
    let history: ProjectFlowHistory?
    let error: String?
    let isLoading: Bool
    let onLoadMore: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Flow history").font(.headline)
            ForEach(history?.events ?? []) { event in
                VStack(alignment: .leading, spacing: 3) {
                    Text(flow.nodes.first(where: { $0.id == event.nodeId })?.name ?? event.nodeId)
                        .font(.subheadline.weight(.medium))
                    Text("\(event.kind.capitalized) · \(event.createdAt)")
                        .font(.caption).foregroundStyle(.secondary)
                    if let detail = event.detail { Text(detail).font(.caption) }
                }
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
            if history?.hasMore == true || error != nil {
                Button(error == nil ? "Load more history" : "Retry history", action: onLoadMore)
                    .disabled(isLoading)
            }
        }
    }
}

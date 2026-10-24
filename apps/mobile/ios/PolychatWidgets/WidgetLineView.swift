import SwiftUI

struct WidgetLineView: View {
    let line: WidgetSnapshot.Line
    var showsDetail = true

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: line.systemImage)
                .font(.caption)
                .foregroundStyle(.tint)
                .frame(width: 14)
            VStack(alignment: .leading, spacing: 1) {
                Text(line.title)
                    .font(.caption.weight(.medium))
                    .lineLimit(2)
                if showsDetail, let detail = line.detail {
                    Text(detail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }
}

struct WidgetEmptyText: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(.secondary)
    }
}

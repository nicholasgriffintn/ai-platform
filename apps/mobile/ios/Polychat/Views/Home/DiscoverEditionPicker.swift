import SwiftUI

struct DiscoverEditionPicker: View {
    let editions: [DiscoverEditionSummary]
    let selectedId: String?
    let onSelect: (DiscoverEditionSummary) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(editions) { summary in
                    let isSelected = summary.id == selectedId
                    Button {
                        onSelect(summary)
                    } label: {
                        Label(summary.label, systemImage: summary.isEvening ? "moon" : "sun.max")
                            .font(.footnote.weight(isSelected ? .semibold : .regular))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .foregroundStyle(isSelected ? Color.polychat.primaryForeground : Color.polychat.text)
                            .background(
                                isSelected ? Color.polychat.primary : Color.polychat.surface,
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(Color.polychat.border, lineWidth: isSelected ? 0 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
        }
    }
}

import SwiftUI

struct PolyView: View {
    @EnvironmentObject var polyStore: PolyStore
    @Environment(\.dismiss) private var dismiss
    let onOpenConversation: (String) -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        PetSpriteView(mood: polyStore.presence.mood, size: 64)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Poly").font(.headline)
                            Text(polyStore.presence.status)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                }

                if let agenda = polyStore.agenda {
                    itemsSection("Needs you", items: agenda.needsYou)
                    itemsSection("Working on", items: agenda.workingOn)
                    itemsSection("Noted quietly", items: agenda.noted)
                    controls(agenda)
                } else if polyStore.isLoading {
                    ProgressView("Opening Poly…")
                }

                if let error = polyStore.error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle("Poly")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if let agenda = polyStore.agenda {
                        Button("Chat") { open(agenda.conversationId) }
                    }
                }
            }
            .refreshable { await polyStore.refresh() }
            .task { await polyStore.refresh() }
        }
    }

    @ViewBuilder
    private func itemsSection(_ title: String, items: [PolyAgendaItem]) -> some View {
        if !items.isEmpty {
            Section(title) {
                ForEach(items) { item in
                    Button {
                        open(item.conversationId)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).foregroundStyle(.primary)
                            Text(item.status.replacingOccurrences(of: "_", with: " "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func controls(_ agenda: PolyAgenda) -> some View {
        Section {
            Toggle(
                "Take a read-only look each morning",
                isOn: Binding(
                    get: { agenda.lookAround.enabled },
                    set: { enabled in Task { await polyStore.setLookAround(enabled) } }
                )
            )

            if agenda.pausedUntil != nil, polyStore.presence.mood == .doze {
                Button("Resume now") { Task { await polyStore.pause(until: nil) } }
            } else {
                Button("Pause for an hour") {
                    Task { await polyStore.pause(until: Date().addingTimeInterval(60 * 60)) }
                }
                Button("Pause until tomorrow morning") {
                    Task { await polyStore.pause(until: Self.tomorrowMorning()) }
                }
            }
        } header: {
            Text("Background")
        } footer: {
            Text("While paused, routines wait and only urgent things reach you.")
        }
    }

    private func open(_ conversationId: String) {
        dismiss()
        onOpenConversation(conversationId)
    }

    private static func tomorrowMorning() -> Date {
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return calendar.date(bySettingHour: 8, minute: 0, second: 0, of: tomorrow) ?? tomorrow
    }
}

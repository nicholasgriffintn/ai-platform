import SwiftUI

struct DiscoverDaySheet: View {
    @EnvironmentObject private var store: DiscoverStore
    @Environment(\.dismiss) private var dismiss
    @State private var draft: DiscoverDayProfile
    @State private var topics: String
    @State private var mutes: String
    @State private var error: String?
    @State private var saving = false
    let onPoly: () -> Void

    init(profile: DiscoverDayProfile, audioEnabled: Bool, onPoly: @escaping () -> Void) {
        var initial = profile
        if !audioEnabled {
            initial.audio.morning.enabled = false
            initial.audio.evening.enabled = false
        }
        _draft = State(initialValue: initial)
        _topics = State(initialValue: profile.topics.joined(separator: ", "))
        _mutes = State(initialValue: profile.mutedTopics.joined(separator: ", "))
        self.onPoly = onPoly
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(draft.onboarded
                         ? "Tell Poly what has changed, whether it is just tomorrow or your usual routine."
                         : "Tell Poly about your week and what interests you. It will help you choose useful updates, one question at a time.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button(draft.onboarded ? "Update with Poly" : "Set up Discover with Poly", systemImage: "bubble.left") {
                        dismiss()
                        onPoly()
                    }
                    .buttonStyle(.borderedProminent)
                }
                Section("Or edit a part of your day") {
                    NavigationLink {
                        DiscoverDayRoutineEditor(profile: $draft)
                    } label: {
                        DiscoverDaySummaryRow(title: "Your usual week", summary: draft.weekSummary)
                    }
                    NavigationLink {
                        DiscoverDayCatchUpEditor(moments: $draft.moments)
                    } label: {
                        DiscoverDaySummaryRow(title: "Catch-up times", summary: "\(draft.moments.morning) · \(draft.moments.lunch) · \(draft.moments.afternoon) · \(draft.moments.evening)")
                    }
                    NavigationLink {
                        Form {
                            TextField("Topics, separated by commas", text: $topics)
                            TextField("Leave out", text: $mutes)
                        }
                        .navigationTitle("Interests")
                    } label: {
                        DiscoverDaySummaryRow(title: "Interests", summary: topics.isEmpty ? "From your chats and follows" : topics)
                    }
                    NavigationLink {
                        Form {
                            Text(draft.weatherLocation.map { "Weather: \($0.label)" } ?? "Weather is off")
                            Text(draft.commute.map { "Public transport: \($0.origin.label) to \($0.destination.label)" } ?? "Travel is off")
                            Button("Change places with Poly") { dismiss(); onPoly() }
                        }
                        .navigationTitle("Weather and travel")
                    } label: {
                        DiscoverDaySummaryRow(title: "Weather and travel", summary: draft.weatherLocation?.label ?? (draft.commute == nil ? "Off" : "Public transport"))
                    }
                    NavigationLink {
                        DiscoverDayLinesEditor(lineStatus: Binding(
                            get: { draft.lineStatus ?? .off },
                            set: { draft.lineStatus = $0 }
                        ))
                    } label: {
                        DiscoverDaySummaryRow(title: "Line status", summary: draft.lineStatusSummary)
                    }
                    NavigationLink {
                        DiscoverDayAudioEditor(audio: $draft.audio)
                    } label: {
                        DiscoverDaySummaryRow(title: "Podcasts", summary: draft.audioSummary)
                    }
                    NavigationLink {
                        DiscoverDayNotificationsEditor(notifications: $draft.notifications)
                    } label: {
                        DiscoverDaySummaryRow(title: "Notifications", summary: draft.alertSummary)
                    }
                    NavigationLink {
                        DiscoverDayOverrideEditor(profile: draft) { override, removing in
                            save(override: override, removing: removing)
                        }
                    } label: {
                        DiscoverDaySummaryRow(title: "Change a single day", summary: draft.overrides.isEmpty ? "Use your usual week" : "\(draft.overrides.count) planned")
                    }
                }
                if let error {
                    Section { Text(error).foregroundStyle(Color.polychat.attention) }
                }
            }
            .navigationTitle("Your day")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") { save() }
                        .disabled(saving)
                }
            }
            .disabled(saving)
        }
    }

    private func save(override: DiscoverDayProfile.Override? = nil, removing: String? = nil) {
        let request = DiscoverDayForm.request(profile: draft, topics: topics, mutes: mutes, override: override, removing: removing)
        saving = true
        Task {
            defer { saving = false }
            do {
                try await store.saveDay(request)
                dismiss()
            } catch {
                self.error = "Your day could not be saved. Reopen it to load the latest preferences. \(error.localizedDescription)"
            }
        }
    }
}

private struct DiscoverDaySummaryRow: View {
    let title: String
    let summary: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
            Text(summary).font(.caption).foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
    }
}

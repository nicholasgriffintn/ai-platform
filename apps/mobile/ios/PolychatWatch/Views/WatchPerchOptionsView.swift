import SwiftUI

struct WatchPerchOptionsView: View {
    @EnvironmentObject private var perch: PerchStore

    var body: some View {
        List {
            Section {
                NavigationLink {
                    WatchPetPickerView()
                } label: {
                    LabeledContent("Pet", value: perch.name(of: perch.preferences.selection))
                }
                Picker("Crown feel", selection: feel) {
                    Text("Match \(perch.name(of: perch.preferences.selection))").tag(CrownFeel?.none)
                    ForEach(CrownFeel.allCases) { feel in
                        Text(feel.title).tag(CrownFeel?.some(feel))
                    }
                }
            } footer: {
                Text(perch.feel.summary)
            }

            Section {
                Toggle("Wind to approve", isOn: windToApprove)
                Picker("Buzz", selection: milestoneEvery) {
                    ForEach(PerchPreferences.milestoneChoices, id: \.self) { turns in
                        Text(PerchPreferences.milestoneLabel(turns)).tag(turns)
                    }
                }
                Toggle("Animate your pet", isOn: animated)
                    .disabled(perch.isSaving)
            } footer: {
                if let error = perch.error {
                    Text(error)
                }
            }

            Section("Fidgeting") {
                LabeledContent("Today", value: PerchStats.label(turns: perch.turnsToday))
                LabeledContent("Longest spin", value: PerchStats.label(turns: perch.stats.longestSpin))
            }
        }
        .navigationTitle("Options")
    }

    private var feel: Binding<CrownFeel?> {
        Binding(
            get: { perch.preferences.feelOverride(for: perch.preferences.selection) },
            set: { perch.setFeel($0) }
        )
    }

    private var windToApprove: Binding<Bool> {
        Binding(get: { perch.preferences.windToApprove }, set: { perch.setWindToApprove($0) })
    }

    private var milestoneEvery: Binding<Int> {
        Binding(get: { perch.preferences.milestoneEvery }, set: { perch.setMilestoneEvery($0) })
    }

    private var animated: Binding<Bool> {
        Binding(
            get: { perch.preferences.animated },
            set: { enabled in Task { await perch.setAnimated(enabled) } }
        )
    }
}

private struct WatchPetPickerView: View {
    @EnvironmentObject private var perch: PerchStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List(perch.choices, id: \.self) { selection in
            Button {
                Task {
                    await perch.choose(selection)
                    dismiss()
                }
            } label: {
                HStack(spacing: 8) {
                    thumbnail(selection)
                    Text(perch.name(of: selection))
                    Spacer(minLength: 0)
                    if selection == perch.preferences.selection {
                        Image(systemName: "checkmark")
                            .foregroundStyle(.tint)
                    }
                }
            }
            .disabled(perch.isSaving)
            .task { await perch.loadThumbnail(selection) }
        }
        .navigationTitle("Pet")
    }

    @ViewBuilder
    private func thumbnail(_ selection: PetSelection) -> some View {
        if let image = perch.thumbnails[selection] {
            Image(decorative: image, scale: 2)
                .resizable()
                .scaledToFit()
                .frame(width: 34, height: 34)
        } else {
            Color.clear.frame(width: 34, height: 34)
        }
    }
}

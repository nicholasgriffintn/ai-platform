import SwiftUI

struct PerchSettingsView: View {
    @EnvironmentObject private var store: PerchStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Form {
            heroSection
            petSection
            motionSection
            if WatchBridge.isSupported {
                feelSection
                watchSection
                statsSection
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.polychat.background)
        .navigationTitle(store.pet?.name ?? "Your pet")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.refresh() }
    }

    private var snapshot: WidgetSnapshot { WidgetSnapshotStore.read() }
    private var isAnimating: Bool { store.preferences.animated && !reduceMotion }

    private var heroSection: some View {
        Section {
            VStack(spacing: 8) {
                if let pet = store.pet {
                    TimelineView(.animation(minimumInterval: 1.0 / 8, paused: !isAnimating)) { context in
                        PetSpriteView(
                            sheet: pet.sheet,
                            clip: PetClipName(pose: snapshot.pose()),
                            time: isAnimating ? context.date.timeIntervalSinceReferenceDate : 0,
                            size: 132
                        )
                    }
                    Text(pet.name)
                        .font(.headline)
                } else {
                    ProgressView()
                        .frame(height: 132)
                }
                Text(snapshot.poly?.status ?? "Ready when you are")
                    .font(.caption)
                    .foregroundStyle(Color.polychat.textMuted)
            }
            .frame(maxWidth: .infinity)
            .listRowBackground(Color.clear)
        }
    }

    private var petSection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(store.choices, id: \.self) { selection in
                        PerchPetChoice(
                            name: store.name(of: selection),
                            image: store.thumbnails[selection],
                            isSelected: selection == store.preferences.selection
                        ) {
                            Task { await store.choose(selection) }
                        }
                        .task { await store.loadThumbnail(selection) }
                    }
                }
                .padding(.vertical, 4)
            }
            .disabled(store.isSaving)

            if let error = store.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.error)
            }
        } header: {
            Text("Pet")
        } footer: {
            Text("This is your pet everywhere you use Polychat, including web and desktop.")
        }
    }

    private var motionSection: some View {
        Section {
            Toggle(
                "Animate your pet",
                isOn: Binding(
                    get: { store.preferences.animated },
                    set: { enabled in Task { await store.setAnimated(enabled) } }
                )
            )
            .disabled(store.isSaving)
        } footer: {
            Text("Off, your pet holds its pose until you play with it. This is the same setting as on web and desktop, and your reduced motion preference always wins.")
        }
    }

    private var feelSection: some View {
        Section {
            Picker(
                "Crown feel",
                selection: Binding(
                    get: { store.preferences.feelOverride(for: store.preferences.selection) },
                    set: { store.setFeel($0) }
                )
            ) {
                Text("Match \(store.pet?.name ?? "pet")").tag(CrownFeel?.none)
                ForEach(CrownFeel.allCases) { feel in
                    Text(feel.title).tag(CrownFeel?.some(feel))
                }
            }

            PerchFeelDial(feel: store.feel)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        } header: {
            Text("Crown")
        } footer: {
            Text("\(store.feel.summary) Turn the dial to get a rough idea here. It feels different on the watch.")
        }
    }

    private var watchSection: some View {
        Section {
            Toggle(
                "Wind to approve",
                isOn: Binding(get: { store.preferences.windToApprove }, set: { store.setWindToApprove($0) })
            )
            Picker(
                "Buzz",
                selection: Binding(
                    get: { store.preferences.milestoneEvery },
                    set: { store.setMilestoneEvery($0) }
                )
            ) {
                ForEach(PerchPreferences.milestoneChoices, id: \.self) { turns in
                    Text(PerchPreferences.milestoneLabel(turns)).tag(turns)
                }
            }
        } header: {
            Text("On your watch")
        } footer: {
            Text("You can change these on your watch too. Wind to approve asks for a full turn of the crown when you approve something in the watch app, so a stray tap can't do it there. Approve on a notification is still one tap. Declining is still a button, and VoiceOver always gets a button.")
        }
    }

    private var statsSection: some View {
        Section {
            LabeledContent("Today", value: PerchStats.label(turns: store.turnsToday))
            LabeledContent("All time", value: PerchStats.label(turns: store.stats.totalTurns))
            LabeledContent("Longest spin", value: PerchStats.label(turns: store.stats.longestSpin))
        } header: {
            Text("Fidgeting")
        } footer: {
            Text("These stay on your devices and aren't sent to Polychat.")
        }
    }
}

private struct PerchPetChoice: View {
    let name: String
    let image: CGImage?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Group {
                    if let image {
                        Image(decorative: image, scale: 1)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 56, height: 56)
                    } else {
                        ProgressView()
                            .frame(width: 56, height: 56)
                    }
                }
                .padding(6)
                .background(isSelected ? Color.polychat.selection : .clear, in: RoundedRectangle(cornerRadius: 12))
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? Color.polychat.primary : Color.polychat.border, lineWidth: isSelected ? 2 : 1)
                }

                Text(name)
                    .font(.caption)
                    .lineLimit(1)
                    .foregroundStyle(Color.polychat.text)
            }
            .frame(width: 76)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

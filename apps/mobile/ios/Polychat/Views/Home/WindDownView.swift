import SwiftUI

struct WindDownView: View {
    @ObservedObject var controller: WindDownPlaybackController
    let windDownId: String?

    @State private var choosing = false
    @State private var kind = "breathing"
    @State private var minutes = 10
    @State private var bed: String?
    @State private var topic = ""
    @State private var notes = ""
    @State private var aboutToday = true

    private var showsChooser: Bool {
        choosing || controller.windDown == nil || controller.windDown?.status == "failed"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                stage

                if showsChooser {
                    chooser
                } else if let windDown = controller.windDown, windDown.isReady {
                    controls(windDown)
                } else {
                    MediaNotice(message: "Settling in. Poly is recording your wind down.")
                }

                if let error = controller.error {
                    InlineErrorBanner(message: error)
                }
            }
            .padding(16)
        }
        .animation(.easeInOut, value: controller.stepIndex)
        .task(id: windDownId) {
            if controller.windDown == nil, let windDownId {
                await controller.load(id: windDownId)
            }
            await controller.waitUntilReady()
        }
        .task(id: showsChooser) {
            if showsChooser { await controller.loadTonight() }
        }
    }

    private var stage: some View {
        ZStack {
            WindDownSceneView(
                bed: controller.windDown?.sceneBed ?? controller.tonight?.bed ?? "night",
                seed: controller.windDown?.id ?? "wind-down",
                moving: controller.isPlaying
            )
            if let text = controller.currentText, controller.isPlaying {
                Text(text)
                    .font(.polychatDisplay(.title3))
                    .foregroundStyle(.white.opacity(0.92))
                    .multilineTextAlignment(.center)
                    .shadow(radius: 4)
                    .padding(.horizontal, 24)
                    .padding(.top, 56)
                    .id(controller.stepIndex)
                    .transition(.opacity)
            }
            VStack {
                WindDownBalanceView(balance: $controller.balance)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                Spacer()
            }
        }
        .frame(height: 280)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    @ViewBuilder
    private func controls(_ windDown: DiscoverWindDown) -> some View {
        Text(windDown.title).font(.polychatDisplay(.title3))
        ProgressView(value: controller.progress)
            .tint(Color.polychat.primary)
        HStack(spacing: 12) {
            Button {
                controller.togglePlayback()
            } label: {
                Label(controller.isPlaying ? "Pause" : "Begin", systemImage: controller.isPlaying ? "pause.fill" : "play.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .tint(Color.polychat.primary)
            AirPlayButton()
                .frame(width: 36, height: 36)
                .accessibilityLabel("Play on Apple TV or speakers")
        }
        HStack {
            afterVoiceMenu
            Spacer()
            Button("Choose another") {
                controller.stop()
                choosing = true
            }
        }
        .font(.footnote)

        if let parked = windDown.parked, !parked.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                EyebrowLabel("Waiting for the morning")
                ForEach(parked, id: \.self) { item in
                    Label(item, systemImage: "tray")
                        .font(.subheadline)
                }
            }
        }
    }

    private var afterVoiceMenu: some View {
        Menu {
            Picker("After the voice", selection: $controller.afterVoiceMinutes) {
                ForEach(DiscoverWindDown.afterVoiceMinutes, id: \.self) { minutes in
                    Text(minutes == 0 ? "Sound stops with the voice" : "Sound plays on for \(minutes) min").tag(minutes)
                }
            }
        } label: {
            Label(
                controller.afterVoiceMinutes == 0 ? "Sound after: off" : "Sound after: \(controller.afterVoiceMinutes) min",
                systemImage: "moon.zzz"
            )
        }
    }

    @ViewBuilder
    private var chooser: some View {
        if let tonight = controller.tonight {
            VStack(alignment: .leading, spacing: 8) {
                EyebrowLabel("Tonight")
                Text("\(DiscoverWindDown.title(forKind: tonight.kind)), \(tonight.minutes) min")
                    .font(.polychatDisplay(.title3))
                Text(tonight.reason)
                    .font(.subheadline)
                    .foregroundStyle(Color.polychat.textMuted)
                startButton("Begin") { tonight.request(aboutToday: true) }
            }
            .padding(14)
            .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }

        EyebrowLabel(controller.tonight == nil ? "What kind" : "Or choose")
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(DiscoverWindDown.kinds.filter { $0.id != "read_back" || controller.tonight?.readBack == true }) { option in
                Button { kind = option.id } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(option.title).font(.subheadline.weight(.semibold))
                        Text(option.detail)
                            .font(.caption)
                            .foregroundStyle(Color.polychat.textMuted)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56, alignment: .topLeading)
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(kind == option.id ? Color.polychat.text : Color.polychat.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }

        if kind == "story" {
            TextField("What it wanders through", text: $topic, prompt: Text(controller.tonight?.topic ?? "Leave empty and Poly picks"))
                .textFieldStyle(.roundedBorder)
        }
        if kind == "park" {
            TextField("What's on your mind", text: $notes, axis: .vertical)
                .lineLimit(3...6)
                .textFieldStyle(.roundedBorder)
        }
        if kind == "unwind" || kind == "park" {
            Toggle("Mention my day", isOn: $aboutToday)
        }

        Picker("Length", selection: $minutes) {
            ForEach(DiscoverWindDown.lengths, id: \.self) { Text("\($0) min").tag($0) }
        }
        .pickerStyle(.segmented)

        Picker("Sound", selection: $bed) {
            Text("Poly's choice").tag(String?.none)
            ForEach(DiscoverWindDown.beds, id: \.self) { Text($0.capitalized).tag(String?.some($0)) }
        }

        startButton("Start \(DiscoverWindDown.title(forKind: kind).lowercased())") {
            DiscoverWindDownRequest(
                kind: kind,
                minutes: minutes,
                bed: bed,
                aboutToday: kind == "unwind" || kind == "park" ? aboutToday : nil,
                topic: kind == "story" && !topic.isEmpty ? topic : nil,
                notes: kind == "park" && !notes.isEmpty ? notes : nil
            )
        }
    }

    private func startButton(_ title: String, request: @escaping () -> DiscoverWindDownRequest) -> some View {
        Button {
            choosing = false
            Task { await controller.start(request()) }
        } label: {
            Group {
                if controller.isWorking { ProgressView() } else { Text(title) }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .tint(Color.polychat.primary)
        .disabled(controller.isWorking)
    }
}

private struct WindDownBalanceView: View {
    @Binding var balance: Double

    var body: some View {
        HStack(spacing: 10) {
            side("Sound", systemImage: "leaf")
            Slider(value: $balance, in: 0...1)
                .tint(.white.opacity(0.6))
                .accessibilityLabel("Balance between sound and voice")
            side("Voice", systemImage: "mic")
        }
        .foregroundStyle(.white.opacity(0.88))
    }

    private func side(_ title: String, systemImage: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: systemImage)
            Text(title).font(.caption2)
        }
        .frame(width: 44)
    }
}

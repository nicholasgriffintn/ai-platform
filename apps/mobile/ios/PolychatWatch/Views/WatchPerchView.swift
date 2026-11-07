import SwiftUI

private let dragPointsPerTurn = 160.0

struct WatchPerchView: View {
    private static let refreshSeconds = 60

    @EnvironmentObject private var perch: PerchStore
    @EnvironmentObject private var store: WatchStore
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var session = PerchSession()
    @FocusState private var crownFocused: Bool
    @State private var dragStart = 0.0

    private var isActive: Bool { scenePhase == .active && !isLuminanceReduced }
    private var pose: PetPose { store.snapshot.pose() }
    private var restingClip: PetClipName { PetClipName(pose: pose) }
    private var clip: PetClipName { session.engine.clip(resting: restingClip, at: session.now) }
    private var spriteTime: TimeInterval {
        let isHolding = clip == restingClip && !perch.preferences.animated
        return reduceMotion || isHolding ? 0 : session.now
    }
    private var tilt: Double { reduceMotion ? 0 : min(max(session.engine.speed * 14, -20), 20) }

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                PerchRing(heading: session.engine.heading, ticks: perch.feel.ticksPerLoop)
                Button(action: session.poke) {
                    petView
                        .rotationEffect(.degrees(tilt))
                }
                .buttonStyle(.plain)
                .handGestureShortcut(.primaryAction)
                .accessibilityLabel("Poke \(perch.pet?.name ?? "your pet")")
            }
            .aspectRatio(1, contentMode: .fit)

            statusLine
        }
        .navigationTitle(perch.pet?.name ?? "Your pet")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    WatchPerchOptionsView()
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .foregroundStyle(.white)
                }
                .accessibilityLabel("Options")
            }
        }
        .focusable()
        .focused($crownFocused)
        .focusEffectDisabled()
        .crownInput(feel: perch.feel, onTurn: session.crown)
        .simultaneousGesture(dragToSpin)
        .onAppear {
            crownFocused = true
            configureSession()
        }
        .onChange(of: perch.feel) { _, _ in configureSession() }
        .onChange(of: perch.preferences.milestoneEvery) { _, _ in configureSession() }
        .onChange(of: store.actionable.count) { before, after in
            if after < before {
                session.cheer()
            }
        }
        .onChange(of: store.running.count) { before, after in
            if after < before {
                session.cheer()
            }
        }
        .task(id: isActive) {
            guard isActive else {
                saveTurns()
                return
            }
            while !Task.isCancelled {
                session.frame()
                try? await Task.sleep(for: session.frameInterval)
            }
        }
        .task(id: isActive) {
            while isActive && !Task.isCancelled {
                await store.refresh()
                try? await Task.sleep(for: .seconds(Self.refreshSeconds))
            }
        }
        .onDisappear(perform: saveTurns)
    }

    @ViewBuilder
    private var petView: some View {
        if let sheet = perch.pet?.sheet {
            PetSpriteView(sheet: sheet, clip: clip, time: spriteTime, size: 104)
        } else {
            PetPoseImage(pose: pose, size: 104)
                .id(perch.pet?.selection)
        }
    }

    @ViewBuilder
    private var statusLine: some View {
        if let item = store.actionable.first {
            NavigationLink {
                WatchItemView(item: item)
            } label: {
                Label(item.title, systemImage: "exclamationmark.circle")
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .foregroundStyle(Color.polychat.attention)
            }
            .buttonStyle(.plain)
        } else if let working = store.running.first {
            Text(working.title)
                .font(.caption2)
                .lineLimit(1)
                .foregroundStyle(.secondary)
        } else {
            Text(PerchStats.label(turns: session.turns))
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
        }
    }

    private var dragToSpin: some Gesture {
        DragGesture(minimumDistance: 6)
            .onChanged { value in
                let distance = value.translation.width
                session.turn(by: (distance - dragStart) / dragPointsPerTurn)
                dragStart = distance
            }
            .onEnded { _ in dragStart = 0 }
    }

    private func configureSession() {
        session.configure(feel: perch.feel, milestoneEvery: perch.preferences.milestoneEvery)
    }

    private func saveTurns() {
        let result = session.drain()
        perch.record(turns: result.turns, longestSpin: result.longestSpin)
    }
}

private struct PerchRing: View {
    let heading: Double
    let ticks: Int

    var body: some View {
        Canvas { context, size in
            let radius = min(size.width, size.height) / 2
            let center = CGPoint(x: size.width / 2, y: size.height / 2)

            for tick in 0..<ticks {
                let angle = (heading + Double(tick) / Double(ticks)) * 2 * .pi - .pi / 2
                let isMarker = tick == 0
                let inner = radius - (isMarker ? 10 : 6)
                var line = Path()
                line.move(to: point(center, inner, angle))
                line.addLine(to: point(center, radius - 1, angle))
                context.stroke(
                    line,
                    with: .color(isMarker ? Color.polychat.primary : .white.opacity(0.35)),
                    lineWidth: isMarker ? 3 : 1.5
                )
            }
        }
        .accessibilityHidden(true)
    }

    private func point(_ center: CGPoint, _ radius: Double, _ angle: Double) -> CGPoint {
        CGPoint(x: center.x + radius * cos(angle), y: center.y + radius * sin(angle))
    }
}

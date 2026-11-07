import SwiftUI
import WatchKit

struct WatchWindApprovalView: View {
    private static let frameSeconds = 0.1
    private static let holdSeconds = 1.2

    let title: String
    let onApproved: () -> Void

    @EnvironmentObject private var perch: PerchStore
    @FocusState private var crownFocused: Bool
    @State private var gate = WindGate()
    @State private var loop: CrownLoop?
    @State private var lastTurn = Date.distantPast
    @State private var now = Date().timeIntervalSinceReferenceDate

    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.footnote.weight(.medium))
                .lineLimit(2)
                .multilineTextAlignment(.center)

            ZStack {
                Circle()
                    .stroke(.white.opacity(0.15), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: gate.progress)
                    .stroke(Color.polychat.success, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                pet
            }
            .frame(width: 96, height: 96)

            Text("Wind the crown to approve")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .focusable()
        .focused($crownFocused)
        .focusEffectDisabled()
        .crownInput(feel: perch.feel, onTurn: wind)
        .accessibilityValue("\(Int(gate.progress * 100)) percent wound")
        .onAppear { crownFocused = true }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Self.frameSeconds))
                now = Date().timeIntervalSinceReferenceDate
                if Date().timeIntervalSince(lastTurn) > Self.holdSeconds {
                    gate.relax(for: Self.frameSeconds)
                }
            }
        }
    }

    @ViewBuilder
    private var pet: some View {
        if let sheet = perch.pet?.sheet {
            PetSpriteView(sheet: sheet, clip: gate.progress > 0 ? .flit : .wait, time: now, size: 72)
        } else {
            PetPoseImage(pose: .wait, size: 72)
                .id(perch.pet?.selection)
        }
    }

    private func wind(to offset: Double) {
        var current = loop ?? CrownLoop(length: Double(perch.feel.ticksPerLoop))
        let turns = current.turns(to: offset)
        loop = current
        lastTurn = Date()

        if gate.wind(by: turns) {
            WKInterfaceDevice.current().play(.success)
            onApproved()
        }
    }
}

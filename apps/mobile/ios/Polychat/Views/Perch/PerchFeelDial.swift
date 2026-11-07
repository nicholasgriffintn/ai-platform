import SwiftUI

private extension CrownFeel {
    var feedback: SensoryFeedback? {
        switch self {
        case .steady: return .impact(weight: .medium, intensity: 0.6)
        case .ratchet: return .impact(weight: .heavy, intensity: 0.8)
        case .rapid: return .selection
        case .heavy: return .impact(weight: .heavy)
        case .glide: return nil
        }
    }
}

struct PerchFeelDial: View {
    private static let size = 148.0

    let feel: CrownFeel

    @State private var heading = 0.0
    @State private var lastAngle: Double?

    private var tick: Int { Int((heading * Double(feel.ticksPerLoop)).rounded(.down)) }

    var body: some View {
        Canvas { context, size in
            let radius = min(size.width, size.height) / 2
            let center = CGPoint(x: size.width / 2, y: size.height / 2)

            for index in 0..<feel.ticksPerLoop {
                let angle = (heading + Double(index) / Double(feel.ticksPerLoop)) * 2 * .pi - .pi / 2
                let isMarker = index == 0
                var line = Path()
                line.move(to: point(center, radius - (isMarker ? 16 : 10), angle))
                line.addLine(to: point(center, radius - 1, angle))
                context.stroke(
                    line,
                    with: .color(isMarker ? Color.polychat.primary : Color.polychat.borderStrong),
                    lineWidth: isMarker ? 3 : 1.5
                )
            }
        }
        .frame(width: Self.size, height: Self.size)
        .contentShape(Circle())
        .gesture(spin)
        .sensoryFeedback(trigger: tick) { _, _ in feel.feedback }
        .accessibilityHidden(true)
    }

    private var spin: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let middle = Self.size / 2
                let angle = atan2(value.location.y - middle, value.location.x - middle) / (2 * .pi)
                if let lastAngle {
                    var delta = angle - lastAngle
                    if delta > 0.5 {
                        delta -= 1
                    } else if delta < -0.5 {
                        delta += 1
                    }
                    heading += delta
                }
                lastAngle = angle
            }
            .onEnded { _ in lastAngle = nil }
    }

    private func point(_ center: CGPoint, _ radius: Double, _ angle: Double) -> CGPoint {
        CGPoint(x: center.x + radius * cos(angle), y: center.y + radius * sin(angle))
    }
}

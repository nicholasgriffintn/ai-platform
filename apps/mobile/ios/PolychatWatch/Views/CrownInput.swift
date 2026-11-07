import SwiftUI

private extension CrownFeel {
    var sensitivity: DigitalCrownRotationalSensitivity {
        switch self {
        case .ratchet, .heavy: return .low
        case .steady, .glide: return .medium
        case .rapid: return .high
        }
    }
}

private struct CrownInput: ViewModifier {
    let feel: CrownFeel
    let onTurn: (Double) -> Void
    @State private var value = 0.0

    func body(content: Content) -> some View {
        let end = Double(feel.ticksPerLoop)

        if feel.hasTicks {
            content.digitalCrownRotation(
                detent: $value,
                from: 0,
                through: end,
                by: 1,
                sensitivity: feel.sensitivity,
                isContinuous: true,
                isHapticFeedbackEnabled: true,
                onChange: { onTurn($0.offset) }
            )
        } else {
            content.digitalCrownRotation(
                $value,
                from: 0,
                through: end,
                sensitivity: feel.sensitivity,
                isContinuous: true,
                isHapticFeedbackEnabled: false,
                onChange: { onTurn($0.offset) }
            )
        }
    }
}

extension View {
    func crownInput(feel: CrownFeel, onTurn: @escaping (Double) -> Void) -> some View {
        modifier(CrownInput(feel: feel, onTurn: onTurn))
            .digitalCrownAccessory(.hidden)
    }
}

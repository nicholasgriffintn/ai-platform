import Foundation

enum CrownFeel: String, CaseIterable, Codable, Identifiable {
    case steady
    case ratchet
    case rapid
    case heavy
    case glide

    var id: String { rawValue }

    var title: String {
        switch self {
        case .steady: return "Steady"
        case .ratchet: return "Ratchet"
        case .rapid: return "Rapid"
        case .heavy: return "Heavy"
        case .glide: return "Glide"
        }
    }

    var summary: String {
        switch self {
        case .steady: return "Even, medium clicks."
        case .ratchet: return "Chunky gear teeth."
        case .rapid: return "Fine, fast ticks."
        case .heavy: return "Few clicks, lots of weight."
        case .glide: return "No clicks. It just runs on."
        }
    }

    var ticksPerLoop: Int {
        switch self {
        case .steady, .glide: return 24
        case .ratchet: return 12
        case .rapid: return 48
        case .heavy: return 8
        }
    }

    var hasTicks: Bool { self != .glide }

    var friction: Double {
        switch self {
        case .steady: return 2.2
        case .ratchet: return 3.5
        case .rapid: return 1.6
        case .heavy: return 5
        case .glide: return 0.6
        }
    }
}

struct CrownLoop {
    let length: Double
    private var last: Double?

    init(length: Double) {
        self.length = length
    }

    mutating func turns(to offset: Double) -> Double {
        defer { last = offset }
        guard let last else { return 0 }

        var delta = offset - last
        if delta > length / 2 {
            delta -= length
        } else if delta < -length / 2 {
            delta += length
        }
        return delta / length
    }
}

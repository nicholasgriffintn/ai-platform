import SwiftUI

extension DiscoverMediaItem {
    var recording: DiscoverRecording? {
        switch self {
        case .perch: return .listen
        case .week: return .week
        case .episode, .windDown: return nil
        }
    }

    var subtitle: String {
        switch self {
        case .episode: return "Part of a five-day season"
        case .perch: return "Two hosts on today's edition"
        case .week: return "Your week, told back"
        case .windDown: return "5, 10 or 20 minutes"
        }
    }

    var systemImage: String {
        switch self {
        case .episode: return "play.rectangle.fill"
        case .perch: return "headphones"
        case .week: return "calendar"
        case .windDown: return "moon.stars.fill"
        }
    }

    var colours: [Color] {
        switch self {
        case .episode: return [Color(rgb: 46, 98, 201), Color(rgb: 119, 80, 177)]
        case .perch: return [Color(rgb: 7, 108, 146), Color(rgb: 19, 119, 56)]
        case .week: return [Color(rgb: 147, 105, 13), Color(rgb: 201, 47, 51)]
        case .windDown: return [Color(rgb: 26, 42, 61), Color(rgb: 60, 87, 138)]
        }
    }
}

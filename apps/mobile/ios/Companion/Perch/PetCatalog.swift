import CoreGraphics
import Foundation

enum PetClipName: String {
    case idle, blink, preen, greet, think, work, speak, cheer, fret, doze, flit
    case wait, acknowledge, listen, review

    var fallback: PetClipName? {
        switch self {
        case .wait: return .idle
        case .acknowledge: return .greet
        case .listen, .review: return .think
        default: return nil
        }
    }

    init(pose: PetPose) {
        switch pose {
        case .idle: self = .idle
        case .work: self = .work
        case .wait: self = .wait
        case .doze: self = .doze
        }
    }
}

struct PetClip: Equatable {
    let row: Int
    let frames: Int
    let fps: Double
}

struct PetSheetLayout: Equatable {
    static let frameWidth = 192
    static let frameHeight = 208
    static let columns = 8

    let id: String
    let rows: Int
    let clips: [PetClipName: PetClip]

    var sheetWidth: Int { Self.frameWidth * Self.columns }
    var sheetHeight: Int { Self.frameHeight * rows }

    func clip(_ name: PetClipName) -> PetClip {
        clips[name] ?? name.fallback.flatMap { clips[$0] } ?? clips[.idle] ?? PetClip(row: 0, frames: 1, fps: 1)
    }

    func frameRect(row: Int, column: Int) -> CGRect {
        CGRect(
            x: column * Self.frameWidth,
            y: row * Self.frameHeight,
            width: Self.frameWidth,
            height: Self.frameHeight
        )
    }

    private static let codexClips: [PetClipName: PetClip] = [
        .idle: PetClip(row: 0, frames: 6, fps: 4),
        .flit: PetClip(row: 1, frames: 8, fps: 15),
        .greet: PetClip(row: 3, frames: 4, fps: 8),
        .acknowledge: PetClip(row: 3, frames: 4, fps: 8),
        .cheer: PetClip(row: 4, frames: 5, fps: 12),
        .fret: PetClip(row: 5, frames: 8, fps: 10),
        .think: PetClip(row: 6, frames: 6, fps: 7),
        .wait: PetClip(row: 6, frames: 6, fps: 5),
        .work: PetClip(row: 7, frames: 6, fps: 14),
        .speak: PetClip(row: 8, frames: 6, fps: 11),
        .review: PetClip(row: 8, frames: 6, fps: 8)
    ]

    static let polychat = PetSheetLayout(id: "polychat-v1", rows: 11, clips: [
        .idle: PetClip(row: 0, frames: 8, fps: 4),
        .blink: PetClip(row: 1, frames: 4, fps: 14),
        .preen: PetClip(row: 2, frames: 6, fps: 8),
        .greet: PetClip(row: 3, frames: 4, fps: 8),
        .think: PetClip(row: 4, frames: 6, fps: 7),
        .work: PetClip(row: 5, frames: 8, fps: 14),
        .speak: PetClip(row: 6, frames: 6, fps: 11),
        .cheer: PetClip(row: 7, frames: 6, fps: 12),
        .fret: PetClip(row: 8, frames: 8, fps: 10),
        .doze: PetClip(row: 9, frames: 4, fps: 3),
        .flit: PetClip(row: 10, frames: 8, fps: 15)
    ])
    static let codex = PetSheetLayout(id: "codex-v1", rows: 9, clips: codexClips)
    static let codexV2 = PetSheetLayout(id: "codex-v2", rows: 11, clips: codexClips)

    static func named(_ id: String?) -> PetSheetLayout {
        [polychat, codex, codexV2].first { $0.id == id } ?? polychat
    }
}

struct PetPreset: Identifiable, Equatable {
    let slug: String
    let name: String
    let feel: CrownFeel

    var id: String { slug }
    var selection: PetSelection { PetSelection(source: .preset, id: slug) }
    var sheetURL: URL { Self.assetBaseURL.appendingPathComponent("\(slug).png") }

    private static let assetBaseURL = URL(string: "https://assets.polychat.app/pets")!

    static let all = [
        PetPreset(slug: "pip", name: "Pip", feel: .steady),
        PetPreset(slug: "ash", name: "Ash", feel: .heavy),
        PetPreset(slug: "kea", name: "Kea", feel: .rapid),
        PetPreset(slug: "prism", name: "Prism", feel: .ratchet),
        PetPreset(slug: "bit", name: "Bit", feel: .rapid),
        PetPreset(slug: "sprocket", name: "Sprocket", feel: .ratchet),
        PetPreset(slug: "flask", name: "Flask", feel: .steady),
        PetPreset(slug: "moss", name: "Moss", feel: .heavy),
        PetPreset(slug: "wisp", name: "Wisp", feel: .glide)
    ]

    static func named(_ slug: String) -> PetPreset {
        all.first { $0.slug == slug } ?? PetPreset(slug: slug, name: slug.capitalized, feel: .steady)
    }
}

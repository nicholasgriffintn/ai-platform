import SwiftUI
import UIKit

struct PetSpriteClip: Equatable {
    let row: Int
    let frames: Int
    let fps: Double

    static func forMood(_ mood: PolyMood) -> PetSpriteClip {
        switch mood {
        case .idle, .wait:
            PetSpriteClip(row: 0, frames: 8, fps: 4)
        case .work:
            PetSpriteClip(row: 5, frames: 8, fps: 14)
        case .doze:
            PetSpriteClip(row: 9, frames: 4, fps: 3)
        }
    }
}

@MainActor
private final class PetSheetLoader: ObservableObject {
    @Published private(set) var sheet: CGImage?

    private static var cache: [URL: CGImage] = [:]

    func load(_ url: URL) async {
        if let cached = Self.cache[url] {
            sheet = cached
            return
        }

        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let image = UIImage(data: data)?.cgImage else {
            return
        }

        Self.cache[url] = image
        sheet = image
    }
}

struct PetSpriteView: View {
    static let pipSheetURL = URL(string: "https://assets.polychat.app/pets/pip.png")!
    private static let columns = 8
    private static let rows = 11

    let mood: PolyMood
    var size: CGFloat = 72
    var sheetURL: URL = PetSpriteView.pipSheetURL

    @StateObject private var loader = PetSheetLoader()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let clip = PetSpriteClip.forMood(mood)

        Group {
            if let sheet = loader.sheet {
                TimelineView(.periodic(from: .now, by: 1 / clip.fps)) { timeline in
                    let frame = reduceMotion
                        ? 0
                        : Int(timeline.date.timeIntervalSinceReferenceDate * clip.fps) % clip.frames
                    frameImage(sheet: sheet, row: clip.row, column: frame)
                }
            } else {
                PolyGlyph(mood: mood.rawValue, size: size * 0.8)
            }
        }
        .frame(width: size, height: size * 208 / 192)
        .task(id: sheetURL) {
            await loader.load(sheetURL)
        }
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func frameImage(sheet: CGImage, row: Int, column: Int) -> some View {
        let frameWidth = sheet.width / Self.columns
        let frameHeight = sheet.height / Self.rows
        let rect = CGRect(
            x: column * frameWidth,
            y: row * frameHeight,
            width: frameWidth,
            height: frameHeight
        )

        if let cropped = sheet.cropping(to: rect) {
            Image(decorative: cropped, scale: 1)
                .resizable()
                .interpolation(.medium)
                .scaledToFit()
        }
    }
}

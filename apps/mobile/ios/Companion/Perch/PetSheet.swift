import CoreGraphics
import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import WidgetKit

enum PetSheetError: LocalizedError {
    case unreadable

    var errorDescription: String? { "This pet's sprite sheet could not be read." }
}

final class PetSheet {
    static let poseWidth = 64
    static let poseHeight = 69

    let layout: PetSheetLayout

    private let image: CGImage
    private var frames: [CGRect: CGImage] = [:]

    init(data: Data, layout: PetSheetLayout) throws {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary),
              image.width == layout.sheetWidth,
              image.height == layout.sheetHeight else {
            throw PetSheetError.unreadable
        }
        self.image = image
        self.layout = layout
    }

    func frame(_ name: PetClipName, at time: TimeInterval) -> CGImage? {
        let clip = layout.clip(name)
        return frame(row: clip.row, column: Int(time * clip.fps) % clip.frames)
    }

    func frame(row: Int, column: Int) -> CGImage? {
        let rect = layout.frameRect(row: row, column: column)
        if let frame = frames[rect] { return frame }

        let frame = image.cropping(to: rect)
        frames[rect] = frame
        return frame
    }

    func writePoses() {
        for pose in PetPose.allCases {
            let clip = layout.clip(PetClipName(pose: pose))
            guard let frame = frame(row: clip.row, column: 0),
                  let scaled = Self.poseImage(from: frame),
                  let png = Self.png(from: scaled) else {
                continue
            }
            try? PetPoseStore.write(png, for: pose)
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func poseImage(from frame: CGImage) -> CGImage? {
        guard let context = CGContext(
            data: nil,
            width: poseWidth,
            height: poseHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }
        context.interpolationQuality = .high
        context.draw(frame, in: CGRect(x: 0, y: 0, width: poseWidth, height: poseHeight))
        return context.makeImage()
    }

    private static func png(from image: CGImage) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
            return nil
        }
        CGImageDestinationAddImage(destination, image, nil)
        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }
}

struct LoadedPet {
    let selection: PetSelection
    let name: String
    let feel: CrownFeel
    let sheet: PetSheet
}

enum PetLibrary {
    static func load(_ selection: PetSelection, apiClient: APIClient) async throws -> LoadedPet {
        if let cached = PerchStorage.cachedPet(), cached.record.selection == selection {
            return try loaded(cached.record, data: cached.sheet)
        }

        let (record, data) = try await fetch(selection, apiClient: apiClient)
        let pet = try loaded(record, data: data)
        PerchStorage.cache(record, sheet: data)
        pet.sheet.writePoses()
        return pet
    }

    static func thumbnail(_ selection: PetSelection, apiClient: APIClient) async throws -> CGImage {
        let (record, data) = try await fetch(selection, apiClient: apiClient)
        let layout = PetSheetLayout.named(record.layoutId)
        let scale = 0.5
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: Double(layout.sheetHeight) * scale
        ]
        let idle = layout.clip(.idle)
        let rect = layout.frameRect(row: idle.row, column: 0)
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let sheet = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              let frame = sheet.cropping(to: rect.applying(CGAffineTransform(scaleX: scale, y: scale))) else {
            throw PetSheetError.unreadable
        }
        return frame
    }

    private static func loaded(_ record: PetRecord, data: Data) throws -> LoadedPet {
        LoadedPet(
            selection: record.selection,
            name: record.name,
            feel: record.selection.source == .preset ? PetPreset.named(record.selection.id).feel : .steady,
            sheet: try PetSheet(data: data, layout: .named(record.layoutId))
        )
    }

    private static func fetch(_ selection: PetSelection, apiClient: APIClient) async throws -> (PetRecord, Data) {
        switch selection.source {
        case .preset:
            let preset = PetPreset.named(selection.id)
            let (data, _) = try await URLSession.shared.data(from: preset.sheetURL)
            return (PetRecord(selection: preset.selection, name: preset.name, layoutId: PetSheetLayout.polychat.id), data)
        case .custom:
            async let pet = apiClient.fetchUserPet(id: selection.id)
            async let data = apiClient.fetchUserPetSheet(id: selection.id)
            let record = try await PetRecord(selection: selection, name: pet.name, layoutId: pet.layoutId)
            return (record, try await data)
        }
    }
}

struct PetSpriteView: View {
    let sheet: PetSheet
    let clip: PetClipName
    let time: TimeInterval
    let size: CGFloat

    var body: some View {
        if let frame = sheet.frame(clip, at: time) {
            Image(decorative: frame, scale: 1)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        }
    }
}

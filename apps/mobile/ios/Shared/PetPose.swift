import SwiftUI

enum PetPose: String, CaseIterable, Codable {
    case idle
    case work
    case wait
    case doze
}

enum PetPoseStore {
    private static let folder = "pet-poses"

    private static var directory: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: WidgetSnapshotStore.appGroup)?
            .appendingPathComponent(folder, isDirectory: true)
    }

    private static func file(for pose: PetPose) -> URL? {
        directory?.appendingPathComponent("\(pose.rawValue).png")
    }

    static func image(for pose: PetPose) -> UIImage? {
        guard let path = file(for: pose)?.path else { return nil }
        return UIImage(contentsOfFile: path)
    }

    static func write(_ png: Data, for pose: PetPose) throws {
        guard let directory, let file = file(for: pose) else { return }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try png.write(to: file, options: .atomic)
    }

    static func clear() {
        guard let directory else { return }
        try? FileManager.default.removeItem(at: directory)
    }
}

struct PetPoseImage: View {
    let pose: PetPose
    let size: CGFloat

    var body: some View {
        if let image = PetPoseStore.image(for: pose) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityLabel("Your pet")
        } else {
            PolyMark(size: size)
        }
    }
}

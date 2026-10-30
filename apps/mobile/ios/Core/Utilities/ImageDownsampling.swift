#if canImport(UIKit)
import ImageIO
import UIKit

enum ImageDownsampling {
    static func image(from data: Data?, maxPixelSize: CGFloat) async -> UIImage? {
        guard let data else { return nil }
        return await Task.detached(priority: .userInitiated) {
            decode(data, maxPixelSize: maxPixelSize)
        }.value
    }

    static func images(
        for keys: [String],
        maxPixelSize: CGFloat,
        concurrency: Int,
        fetch: @escaping (String) async -> Data?
    ) async -> [String: UIImage] {
        await withTaskGroup(of: (String, UIImage?).self, returning: [String: UIImage].self) { group in
            var remaining = keys.makeIterator()
            var loaded: [String: UIImage] = [:]

            for _ in 0..<max(1, concurrency) {
                guard let key = remaining.next() else { break }
                group.addTask { (key, await image(from: await fetch(key), maxPixelSize: maxPixelSize)) }
            }

            for await (key, image) in group {
                if let image {
                    loaded[key] = image
                }
                if let next = remaining.next() {
                    group.addTask { (next, await Self.image(from: await fetch(next), maxPixelSize: maxPixelSize)) }
                }
            }

            return loaded
        }
    }

    private static func decode(_ data: Data, maxPixelSize: CGFloat) -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else { return nil }
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ] as CFDictionary
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
        return UIImage(cgImage: image)
    }
}
#endif

import CoreImage.CIFilterBuiltins
import UIKit

enum QRCodeImage {
    static func make(from text: String, scale: CGFloat = 12) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"

        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: scale, y: scale)),
              let image = CIContext().createCGImage(output, from: output.extent) else {
            return nil
        }
        return UIImage(cgImage: image)
    }
}

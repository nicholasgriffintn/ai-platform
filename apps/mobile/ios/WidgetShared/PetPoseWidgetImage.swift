import SwiftUI
import WidgetKit

struct PetPoseWidgetImage: View {
    let pose: PetPose
    let size: CGFloat

    var body: some View {
        if let image = PetPoseStore.image(for: pose) {
            Image(uiImage: image)
                .resizable()
                .widgetAccentedRenderingMode(.fullColor)
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityLabel("Your pet")
        } else {
            PolyMark(size: size)
        }
    }
}

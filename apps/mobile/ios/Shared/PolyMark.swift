import SwiftUI

struct PolyMark: View {
    let size: CGFloat

    var body: some View {
        Image("Logo")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityLabel("Poly")
    }
}

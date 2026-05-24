import SwiftUI

struct PolychatLogoView: View {
    let size: CGFloat

    var body: some View {
        Image("Logo")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityLabel("Polychat")
    }
}

#Preview {
    PolychatLogoView(size: 96)
}

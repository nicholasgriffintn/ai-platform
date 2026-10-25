import AVKit
import SwiftUI

struct AirPlayButton: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let picker = AVRoutePickerView()
        picker.activeTintColor = UIColor(Color.polychat.primary)
        picker.tintColor = UIColor(Color.polychat.textMuted)
        return picker
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {}
}

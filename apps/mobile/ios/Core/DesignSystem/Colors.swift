import SwiftUI
#if os(iOS) || os(tvOS)
import UIKit
#endif

extension Color {
    static let polychat = PolychatColors()
}

struct PolychatColors {
    let zinc100 = Color(rgb: 244, 244, 245)
    let zinc400 = Color(rgb: 161, 161, 170)
    let zinc500 = Color(rgb: 113, 113, 122)
    let zinc800 = Color(rgb: 39, 39, 42)

    var canvas: Color { Color(light: Color(rgb: 249, 250, 252), dark: Color(rgb: 4, 8, 16)) }
    var surface: Color { Color(light: Color(rgb: 255, 255, 255), dark: Color(rgb: 7, 13, 21)) }
    var surfaceElevated: Color { Color(light: Color(rgb: 242, 245, 250), dark: Color(rgb: 13, 19, 27)) }
    var text: Color { Color(light: Color(rgb: 12, 18, 26), dark: Color(rgb: 232, 235, 241)) }
    var textMuted: Color { Color(light: Color(rgb: 90, 100, 114), dark: Color(rgb: 164, 172, 181)) }
    var primary: Color { Color(light: Color(rgb: 46, 98, 201), dark: Color(rgb: 57, 110, 214)) }
    var primaryForeground: Color { Color(rgb: 248, 250, 253) }
    var activeWork: Color { Color(light: Color(rgb: 7, 108, 146), dark: Color(rgb: 72, 191, 245)) }
    var success: Color { Color(light: Color(rgb: 19, 119, 56), dark: Color(rgb: 111, 200, 132)) }
    var creative: Color { Color(light: Color(rgb: 119, 80, 177), dark: Color(rgb: 180, 141, 244)) }
    var attention: Color { Color(light: Color(rgb: 147, 105, 13), dark: Color(rgb: 237, 183, 85)) }
    var error: Color { Color(light: Color(rgb: 201, 47, 51), dark: Color(rgb: 250, 112, 106)) }
    var selection: Color { Color(light: Color(rgb: 218, 233, 254), dark: Color(rgb: 26, 42, 61)) }
    var border: Color { Color(light: Color(rgb: 217, 223, 230), dark: Color(rgb: 31, 37, 44)) }
    var borderStrong: Color { Color(light: Color(rgb: 134, 144, 157), dark: Color(rgb: 92, 100, 111)) }

    var warning: Color { attention }
    var background: Color { canvas }
    var secondaryBackground: Color { surfaceElevated }
    var elevatedBackground: Color { surface }
    var composerBackground: Color { surface }
    var messageUserBackground: Color { selection }
    var prominentControlBackground: Color { primary }
    var prominentControlForeground: Color { primaryForeground }
}

extension Color {
    init(rgb red: Double, _ green: Double, _ blue: Double) {
        self.init(red: red / 255, green: green / 255, blue: blue / 255)
    }

    init?(hex: String) {
        let value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else {
            return nil
        }
        self.init(rgb: Double((rgb >> 16) & 0xFF), Double((rgb >> 8) & 0xFF), Double(rgb & 0xFF))
    }

    init(light: Color, dark: Color) {
        #if os(iOS) || os(tvOS)
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
        #elseif os(watchOS)
        self = dark
        #else
        self = light
        #endif
    }
}

extension Font {
    static func polychatDisplay(_ style: Font.TextStyle, weight: Font.Weight = .semibold) -> Font {
        .system(style, design: .serif).weight(weight)
    }
}

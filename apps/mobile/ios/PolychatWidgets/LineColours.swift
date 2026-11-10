import SwiftUI

extension WidgetSnapshot.LineStatus {
    var colour: Color {
        let hex = Self.colours[id] ?? 0x6E6E73
        return Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    private static let colours: [String: UInt32] = [
        "bakerloo": 0xB36305, "central": 0xE32017, "circle": 0xFFD300, "district": 0x00782A,
        "hammersmith-city": 0xF3A9BB, "jubilee": 0xA0A5A9, "metropolitan": 0x9B0056,
        "northern": 0x000000, "piccadilly": 0x003688, "victoria": 0x0098D4,
        "waterloo-city": 0x95CDBA, "elizabeth": 0x6950A1, "dlr": 0x00A4A7, "liberty": 0x61686B,
        "lioness": 0xFAA61A, "mildmay": 0x0077AD, "suffragette": 0x5BB972, "weaver": 0x823A62,
        "windrush": 0xED1B00, "tram": 0x5FB526
    ]
}

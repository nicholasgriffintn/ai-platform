import SwiftUI

extension Color {
    static let polychat = PolychatColors()
}

struct PolychatColors {
    let primary = Color(red: 37/255, green: 99/255, blue: 235/255)
    let primaryHover = Color(red: 29/255, green: 78/255, blue: 216/255)

    let success = Color(red: 34/255, green: 197/255, blue: 94/255)
    let warning = Color(red: 251/255, green: 191/255, blue: 36/255)
    let error = Color(red: 239/255, green: 68/255, blue: 68/255)

    let zinc50 = Color(red: 250/255, green: 250/255, blue: 250/255)
    let zinc100 = Color(red: 244/255, green: 244/255, blue: 245/255)
    let zinc200 = Color(red: 228/255, green: 228/255, blue: 231/255)
    let zinc300 = Color(red: 212/255, green: 212/255, blue: 216/255)
    let zinc400 = Color(red: 161/255, green: 161/255, blue: 170/255)
    let zinc500 = Color(red: 113/255, green: 113/255, blue: 122/255)
    let zinc600 = Color(red: 82/255, green: 82/255, blue: 91/255)
    let zinc700 = Color(red: 63/255, green: 63/255, blue: 70/255)
    let zinc800 = Color(red: 39/255, green: 39/255, blue: 42/255)
    let zinc900 = Color(red: 24/255, green: 24/255, blue: 27/255)

    var messageUserBackground: Color {
        primary
    }

    var messageAssistantBackground: Color {
        Color(.systemGray6)
    }

    var border: Color {
        Color(.systemGray4)
    }

    var background: Color {
        Color(.systemBackground)
    }

    var secondaryBackground: Color {
        Color(.secondarySystemBackground)
    }
}

extension View {
    func polychatPrimaryButton() -> some View {
        self
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.polychat.primary)
            .cornerRadius(8)
    }

    func polychatSecondaryButton() -> some View {
        self
            .foregroundColor(Color.polychat.primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.polychat.primary.opacity(0.1))
            .cornerRadius(8)
    }

    func polychatCard() -> some View {
        self
            .background(Color.polychat.background)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
}

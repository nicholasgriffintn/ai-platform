import Foundation

struct ComposerPrefill: Identifiable {
    let id = UUID()
    let conversationId: String
    let text: String
}

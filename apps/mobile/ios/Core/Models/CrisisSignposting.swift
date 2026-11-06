import Foundation

enum CrisisSignposting {
    static let text = "If you're thinking about suicide or harming yourself, or you're worried about someone else, support is available now. If anyone is in immediate danger, call your local emergency number. UK and Ireland: Samaritans on 116 123. US and Canada: call or text 988. Anywhere else: findahelpline.com. An AI can't replace this kind of help."

    private static let patterns: [NSRegularExpression] = [
        #"\bsuicid(?:e|al)\b(?!\s+(?:squad|burns?|doors?|linux|missions?|bomb\w*))"#,
        #"\b(?:kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+myself\b"#,
        #"\b(?:end|ending|take|taking)\s+my\s+(?:own\s+)?life\b"#,
        #"\bself[-\s]?(?:harm|harming|injury|injuring)\b"#,
        #"\b(?:want|wanted|wanting|going|plan|planning|ready)\s+to\s+die\b"#,
        #"\bwish\s+i\s+(?:was|were)\s+dead\b"#,
        #"\bdon'?t\s+want\s+to\s+(?:live|be\s+alive|be\s+here\s+any\s?more|wake\s+up)\b"#,
        #"\b(?:no|not\s+any)\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|going\s+on)\b"#,
        #"\bbetter\s+off\s+(?:dead|without\s+me)\b"#,
        #"\bhow\s+(?:many|much)\b[^.?!\n]{0,60}\b(?:overdose|to\s+die|lethal\s+dose)\b"#,
    ].compactMap { try? NSRegularExpression(pattern: $0) }

    static func mentionsCrisis(_ text: String) -> Bool {
        let normalised = text.lowercased().replacingOccurrences(of: "’", with: "'")
        let range = NSRange(normalised.startIndex..., in: normalised)

        return patterns.contains { $0.firstMatch(in: normalised, range: range) != nil }
    }
}

import Foundation

enum DiscoverDayForm {
    static let setupPrompt = "Help me set up or update Discover around my week, interests and catch-up times."

    static func request(profile: DiscoverDayProfile, topics: String, mutes: String, override: DiscoverDayProfile.Override? = nil, removing: String? = nil) -> DiscoverDayRequest {
        if override != nil || removing != nil {
            return DiscoverDayRequest(expectedRevision: profile.revision, override: override, removeOverride: removing)
        }
        return DiscoverDayRequest(
            expectedRevision: profile.revision, timezone: profile.timezone, onboarded: true,
            week: profile.week, moments: profile.moments,
            topics: CommaSeparatedValues.parse(topics), mutedTopics: CommaSeparatedValues.parse(mutes),
            notifications: profile.notifications, audio: profile.audio
        )
    }
}

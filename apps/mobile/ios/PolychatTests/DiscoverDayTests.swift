import Foundation
import Testing
@testable import Polychat

struct DiscoverDayTests {
    @Test func liveFeedDecodesStableRevisionsAndKeepsTheNewestPageOnMerge() throws {
        let json = """
        {"id":"story","revision":2,"sequence":8,"editionId":"discover_live_7","card":{"id":"story","kind":"read","topic":"AI","title":"An update","reason":"You follow AI"},"publishedAt":null,"observedAt":"2026-11-02T12:00:00Z","updatedAt":"2026-11-02T12:01:00Z","expiresAt":"2026-11-05T12:01:00Z","seen":false,"dismissed":false,"signals":["saved"]}
        """
        let item = try JSONDecoder().decode(DiscoverFeedItem.self, from: Data(json.utf8))
        var earlier = item
        earlier.seen = true
        earlier.signals = []
        let merged = DiscoverLivePresentation.merge([item], [earlier])
        #expect(merged.count == 1)
        #expect(merged[0].revision == 2)
        #expect(!merged[0].seen)
        #expect(merged[0].signals == ["saved"])
        #expect(DiscoverLivePresentation.edition(items: merged, reference: nil, now: nil)?.id == "discover_live_7")
    }

    @Test func aDatedOverrideRequestDoesNotOverwriteTheWeeklyRoutineOrNotificationConsent() throws {
        let request = DiscoverDayForm.request(profile: profile(), topics: "AI", mutes: "Sport", override: .init(date: "2026-11-03", mode: .remote))
        let object = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])
        #expect(object["expectedRevision"] as? Int == 4)
        #expect(object["override"] != nil)
        #expect(object["week"] == nil)
        #expect(object["notifications"] == nil)
        #expect(object["topics"] == nil)
    }

    @Test func notificationLinksResolveThroughDiscoverAndRejectUntrustedOrigins() {
        #expect(AppRoute.parse(URL(string: "polychat://discover?discoverItem=alert-1")!) == .discover(.card("alert-1")))
        #expect(AppRoute.parse(URL(string: "https://polychat.app/?discoverItem=alert-1")!) == .discover(.card("alert-1")))
        #expect(AppRoute.parse(URL(string: "https://other.example/?discoverItem=alert-1")!) == nil)
        #expect(AppRoute.parse(URL(string: "http://polychat.app/?discoverItem=alert-1")!) == nil)
    }

    @Test func anExpiredObservationIsLastKnownEvenWhenTheServerMarkedItFresh() throws {
        let observation = try JSONDecoder().decode(DiscoverNow.Observation.self, from: Data("""
        {"id":"weather","kind":"weather","title":"Weather","text":"Rain","source":"OpenWeather","observedAt":"2020-01-01T00:00:00Z","expiresAt":"2020-01-01T01:00:00Z","actionable":true,"stale":false}
        """.utf8))
        #expect(observation.isStale)
    }

    @Test func missingLiveStoriesDoNotReappearFromTheBriefingInTheFeedOrWidget() throws {
        let today = CalendarDate.string(from: Date(), calendar: .current)
        let response = try JSONDecoder().decode(DiscoverResponse.self, from: Data("""
        {"settings":{"enabled":true,"curate":""},"edition":{"id":"morning","date":"\(today)","greeting":"Good morning","brief":[],"feedback":{},"cards":[{"id":"old-story","kind":"read","title":"Morning story","reason":"AI"},{"id":"action","kind":"action","title":"Your next step","reason":"Work"}]},"editions":[],"follows":[],"feed":{"data":[],"last_id":null,"has_more":false,"unseenCount":0,"updatedAt":"2026-11-02T12:00:00Z"}}
        """.utf8))
        let edition = DiscoverLivePresentation.edition(items: [], reference: response.edition, now: nil, feedUpdatedAt: response.feed?.updatedAt)

        #expect(edition?.cards.map(\.id) == ["action"])
        #expect(WidgetSnapshot.Today(discover: response).cards.map(\.title) == ["Your next step"])
        #expect(DiscoverLivePresentation.edition(items: [], reference: response.edition, now: nil) == nil)
    }

    private func profile() -> DiscoverDayProfile {
        DiscoverDayProfile(version: 1, timezone: "Europe/London", onboarded: true,
            week: (0...6).map { .init(weekday: $0, mode: .office, start: "09:00", end: "17:00", outbound: "08:00", returning: "17:30") },
            moments: .init(morning: "07:00", lunch: "12:15", afternoon: "16:30", evening: "19:00"), weatherLocation: nil, commute: nil, topics: [], mutedTopics: [], overrides: [],
            notifications: .init(enabled: false, commute: true, weather: false, news: false, briefings: false, dailyLimit: 2, quietStart: "21:00", quietEnd: "07:00", quietWhileWorking: true),
            audio: .init(morning: .init(enabled: true, time: "07:15"), evening: .init(enabled: false, time: "19:15")), revision: 4, updatedAt: nil)
    }
}

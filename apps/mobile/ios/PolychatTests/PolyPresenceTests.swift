import Foundation
import Testing
@testable import Polychat

struct PolyPresenceTests {
    private func agenda(needsYou: Int = 0, workingOn: Int = 0, pausedUntil: String? = nil) throws -> PolyAgenda {
        func items(_ count: Int, kind: String) -> String {
            (0..<count).map { index in
                """
                {"kind":"\(kind)","id":"\(kind)-\(index)","title":"Item \(index)","status":"running","conversation_id":"c-\(index)","updated_at":null}
                """
            }.joined(separator: ",")
        }

        let paused = pausedUntil.map { "\"\($0)\"" } ?? "null"
        let json = """
        {
            "teammate_id": "platform-poly",
            "context_id": "context-1",
            "conversation_id": "poly-home",
            "autonomy_level": "assistant",
            "standing_approvals": [],
            "tool_rules": [],
            "paused_until": \(paused),
            "look_around": {"enabled": true, "timezone": "Europe/London"},
            "needs_you": [\(items(needsYou, kind: "delegation"))],
            "working_on": [\(items(workingOn, kind: "delegation"))],
            "done": [],
            "noted": []
        }
        """

        return try JSONDecoder().decode(PolyAgenda.self, from: Data(json.utf8))
    }

    @Test func waitsOnThePersonBeforeAnythingElse() throws {
        let presence = PolyPresence.derive(from: try agenda(needsYou: 2, workingOn: 3))

        #expect(presence.mood == .wait)
        #expect(presence.status == "2 things need you")
    }

    @Test func dozesWhilePausedEvenWithWorkInFlight() throws {
        let now = Date(timeIntervalSince1970: 1_799_000_000)
        let presence = PolyPresence.derive(
            from: try agenda(workingOn: 1, pausedUntil: "2027-01-15T08:00:00Z"),
            now: now
        )

        #expect(presence.mood == .doze)
    }

    @Test func showsWorkOnceAPauseHasEnded() throws {
        let now = Date(timeIntervalSince1970: 1_900_000_000)
        let presence = PolyPresence.derive(
            from: try agenda(workingOn: 1, pausedUntil: "2027-01-15T08:00:00Z"),
            now: now
        )

        #expect(presence.mood == .work)
        #expect(presence.status == "Working on one thing")
    }
}

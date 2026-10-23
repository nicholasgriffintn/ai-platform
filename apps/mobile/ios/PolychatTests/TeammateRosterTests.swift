import Foundation
import Testing
@testable import Polychat

struct TeammateRosterTests {
    private let teammates = [
        TeammateSummary(id: "t-ada", name: "Ada", description: "Research lead", avatarUrl: nil),
        TeammateSummary(id: "t-bo", name: "Bo", description: "Writes the copy", avatarUrl: nil),
        TeammateSummary(id: "t-cy", name: "Cy", description: "", avatarUrl: nil),
    ]

    private func roster() throws -> [TeammateRosterEntry] {
        let json = """
        {"data": [
            {"kind":"teammate","teammateId":"t-ada","conversationId":"c-ada","lastActivityAt":"2026-10-21T09:00:00Z","unread":true},
            {"kind":"group","name":"Launch","teammateIds":["t-bo","t-ada"],"conversationId":"c-launch","lastActivityAt":"2026-10-20T09:00:00Z","unread":false}
        ], "has_more": false}
        """

        return try JSONDecoder().decode(TeammateRosterResponse.self, from: Data(json.utf8)).data
    }

    @Test func routesEachConversationToItsTeammateAndGroupsToTheirLead() throws {
        let mapping = TeammateRoster.teammatesByConversation(try roster())

        #expect(mapping == ["c-ada": "t-ada", "c-launch": "t-bo"])
    }

    @Test func namesRowsAndOffersOnlyTeammatesWithoutAConversation() throws {
        let entries = try roster()
        let rows = TeammateRoster.rows(entries: entries, teammates: teammates)

        #expect(rows.map(\.title) == ["Ada", "Launch"])
        #expect(rows.map(\.subtitle) == ["Research lead", "Bo, Ada"])
        #expect(rows.first?.entry.unread == true)
        #expect(
            TeammateRoster.teammatesWithoutConversations(entries: entries, teammates: teammates).map(\.id)
                == ["t-bo", "t-cy"]
        )
    }
}

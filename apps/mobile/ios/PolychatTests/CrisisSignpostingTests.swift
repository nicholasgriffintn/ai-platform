import Testing
@testable import Polychat

struct CrisisSignpostingTests {
    @Test(arguments: [
        "I want to kill myself",
        "I don’t want to be alive",
        "how many of these pills would be an overdose",
    ])
    func recognisesCrisisMessages(text: String) {
        #expect(CrisisSignposting.mentionsCrisis(text))
    }

    @Test(arguments: [
        "kill the process on port 3000",
        "explain a suicide burn for a rocket landing",
    ])
    func leavesOtherMessagesAlone(text: String) {
        #expect(!CrisisSignposting.mentionsCrisis(text))
    }

    @MainActor
    @Test func theAgeGateShowsSupportDetailsForACrisisMessageItStops() async {
        let client = AgeGateAPIClientStub(fetchResult: .success(AgeGateResponse(status: .underAge)))
        let store = AgeGateStore(apiClient: client)

        let decision = Task { await store.ensureConfirmed(message: "I want to kill myself") }

        while !store.isPrompting {
            await Task.yield()
        }

        #expect(store.showsCrisisSignpost)

        store.skip()

        #expect(await decision.value == false)
        #expect(store.showsCrisisSignpost == false)
    }
}

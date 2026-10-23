import Foundation
import Testing
@testable import Polychat

struct AgeGateStoreTests {
    @MainActor
    private func waitForPrompt(_ store: AgeGateStore) async {
        while !store.isPrompting {
            await Task.yield()
        }
    }

    @MainActor
    @Test func adultsSendWithoutBeingAskedAndTheStatusIsCached() async {
        let client = AgeGateAPIClientStub(fetchResult: .success(AgeGateResponse(status: .adult)))
        let store = AgeGateStore(apiClient: client)

        #expect(await store.ensureConfirmed())
        #expect(await store.ensureConfirmed())
        #expect(store.isPrompting == false)
        #expect(client.fetchCount == 1)
    }

    @MainActor
    @Test func confirmingAnAdultDateRecordsOnlyTheCalendarDateAndLetsTheMessageSend() async throws {
        let client = AgeGateAPIClientStub(fetchResult: .success(AgeGateResponse(status: .pending)))
        let store = AgeGateStore(apiClient: client)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let birthDate = try #require(calendar.date(from: DateComponents(year: 1990, month: 3, day: 7)))

        let decision = Task { await store.ensureConfirmed() }
        await waitForPrompt(store)
        await store.confirm(birthDate: birthDate, calendar: calendar)

        #expect(await decision.value)
        #expect(client.confirmedBirthDates == ["1990-03-07"])
        #expect(store.status == .adult)
        #expect(store.isPrompting == false)
    }

    @MainActor
    @Test func skippingBlocksThisMessageAndAsksAgainNextTime() async {
        let client = AgeGateAPIClientStub(fetchResult: .success(AgeGateResponse(status: .pending)))
        let store = AgeGateStore(apiClient: client)

        let first = Task { await store.ensureConfirmed() }
        await waitForPrompt(store)
        store.skip()
        #expect(await first.value == false)

        let second = Task { await store.ensureConfirmed() }
        await waitForPrompt(store)
        #expect(store.isPrompting)
        store.skip()
        #expect(await second.value == false)
        #expect(client.confirmedBirthDates.isEmpty)
    }

    @MainActor
    @Test func anUnderAgeAnswerKeepsSendingBlocked() async {
        let client = AgeGateAPIClientStub(
            fetchResult: .success(AgeGateResponse(status: .pending)),
            confirmResult: .success(AgeGateResponse(status: .underAge))
        )
        let store = AgeGateStore(apiClient: client)

        let decision = Task { await store.ensureConfirmed() }
        await waitForPrompt(store)
        await store.confirm(birthDate: Date())

        #expect(store.status == .underAge)
        #expect(store.isPrompting)
        store.skip()
        #expect(await decision.value == false)
    }

    @MainActor
    @Test func anUnreachableStatusLetsTheServerDecide() async {
        let client = AgeGateAPIClientStub(fetchResult: .failure(TestFailure.forced))
        let store = AgeGateStore(apiClient: client)

        #expect(await store.ensureConfirmed())
        #expect(store.isPrompting == false)
    }
}

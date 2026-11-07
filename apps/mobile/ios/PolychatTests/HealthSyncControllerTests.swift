import Foundation
import Testing
@testable import Polychat

@Suite(.serialized)
struct HealthSyncControllerTests {
    private static let enabledKey = "discover.sharesAppleHealth"
    private static let ownerKey = "discover.healthOwnerUserId"

    private func clear() {
        UserDefaults.standard.removeObject(forKey: Self.enabledKey)
        UserDefaults.standard.removeObject(forKey: Self.ownerKey)
    }

    private func optIn(owner: Int?) {
        UserDefaults.standard.set(true, forKey: Self.enabledKey)
        UserDefaults.standard.set(owner, forKey: Self.ownerKey)
    }

    @MainActor
    @Test func signingOutWithdrawsTheOptInSoTheNextAccountDoesNotInheritIt() {
        optIn(owner: 7)
        defer { clear() }

        let controller = HealthSyncController()
        #expect(controller.isEnabled)

        controller.reset()

        #expect(controller.isEnabled == false)
        #expect(HealthSyncController().isEnabled == false)
    }

    @MainActor
    @Test func anOptInFromBeforeAccountsWereRecordedIsWithdrawn() {
        optIn(owner: nil)
        defer { clear() }

        #expect(HealthSyncController().isEnabled == false)
        #expect(UserDefaults.standard.bool(forKey: Self.enabledKey) == false)
    }

    @MainActor
    @Test func anotherAccountCannotUseTheOwnersOptIn() {
        optIn(owner: 7)
        defer { clear() }

        let controller = HealthSyncController()
        controller.confirmOwner(userId: 8)

        #expect(controller.isEnabled == false)
    }

    @MainActor
    @Test func theOwnerKeepsTheirOptIn() {
        optIn(owner: 7)
        defer { clear() }

        let controller = HealthSyncController()
        controller.confirmOwner(userId: 7)
        controller.confirmOwner(userId: nil)

        #expect(controller.isEnabled)
    }

    @MainActor
    @Test func healthCannotBeTurnedOnWithoutAKnownAccount() async {
        clear()
        defer { clear() }

        let controller = HealthSyncController()
        await controller.setEnabled(true, userId: nil)

        #expect(controller.isEnabled == false)
        #expect(controller.error != nil)
    }
}

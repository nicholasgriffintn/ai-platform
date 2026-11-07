import Foundation
import Testing
@testable import Polychat

struct AuthenticationManagerTests {
    @MainActor
    @Test(arguments: [401, 403])
    func theServerRefusingACredentialEndsTheSession(status: Int) {
        #expect(AuthenticationManager.isCredentialRejection(APIClientError.httpStatus(status, "No")))
    }

    @MainActor
    @Test func serverFaultsKeepTheSession() {
        #expect(AuthenticationManager.isCredentialRejection(APIClientError.httpStatus(503, "Down")) == false)
    }

    @MainActor
    @Test func beingOfflineKeepsTheSession() {
        #expect(AuthenticationManager.isCredentialRejection(URLError(.notConnectedToInternet)) == false)
    }
}

import Foundation
import Testing
@testable import Polychat

private final class DelayedDiscoverProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var requestStarted = false

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestStarted = true
        let body = Data("""
        {"settings":{"enabled":true,"curate":""},"edition":null,"editions":[],"follows":[]}
        """.utf8)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!

        DispatchQueue.global().asyncAfter(deadline: .now() + 0.2) { [self] in
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    override func stopLoading() {}
}

@Suite(.serialized)
struct DiscoverStoreTests {
    @MainActor
    @Test func aResponseArrivingAfterSignOutIsDropped() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [DelayedDiscoverProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://example.test")!,
            session: URLSession(configuration: configuration)
        )
        client.setAuthToken("token")
        var published = 0
        let store = DiscoverStore(apiClient: client, onDiscover: { _ in published += 1 })
        DelayedDiscoverProtocol.requestStarted = false

        let refresh = Task { await store.refresh() }
        while !DelayedDiscoverProtocol.requestStarted {
            await Task.yield()
        }
        store.reset()
        await refresh.value

        #expect(store.discover == nil)
        #expect(published == 0)
    }

    @MainActor
    @Test func aResponseForTheCurrentSessionIsKept() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [DelayedDiscoverProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://example.test")!,
            session: URLSession(configuration: configuration)
        )
        client.setAuthToken("token")
        var published = 0
        let store = DiscoverStore(apiClient: client, onDiscover: { _ in published += 1 })

        await store.refresh()

        #expect(store.discover != nil)
        #expect(published == 1)
    }
}

import XCTest

final class PolychatUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunchesToKnownEntryPoint() throws {
        let app = XCUIApplication()
        app.launch()

        let didReachKnownState = waitForAnyElement(
            [
                app.staticTexts["Polychat"],
                app.navigationBars["Conversations"],
                app.staticTexts["Loading Polychat..."]
            ],
            timeout: 10
        )

        XCTAssertTrue(didReachKnownState)
    }

    @MainActor
    func testLaunchPerformance() throws {
        if #available(macOS 10.15, iOS 13.0, tvOS 13.0, watchOS 7.0, *) {
            measure(metrics: [XCTApplicationLaunchMetric()]) {
                XCUIApplication().launch()
            }
        }
    }
}

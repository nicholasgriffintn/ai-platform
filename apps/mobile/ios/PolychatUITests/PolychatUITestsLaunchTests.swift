import XCTest

final class PolychatUITestsLaunchTests: XCTestCase {
    override class var runsForEachTargetApplicationUIConfiguration: Bool {
        true
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunch() throws {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(
            waitForAnyElement(
                [
                    app.staticTexts["Polychat"],
                    app.navigationBars["Conversations"],
                    app.staticTexts["Loading Polychat..."]
                ],
                timeout: 10
            )
        )

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Launch Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

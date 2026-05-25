import XCTest

func waitForAnyElement(_ elements: [XCUIElement], timeout: TimeInterval) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
        if elements.contains(where: { $0.exists }) {
            return true
        }
        RunLoop.current.run(until: Date().addingTimeInterval(0.1))
    }

    return elements.contains(where: { $0.exists })
}
